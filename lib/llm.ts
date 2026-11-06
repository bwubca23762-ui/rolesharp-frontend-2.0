import { env } from "./env";
import { deadlineSignal, LLM_REQUEST_TIMEOUT_MS } from "./request-deadline";
import { resolveGateway } from "./gateway-settings";

// ---------------------------------------------------------------------------
// Multi-key Gemini rotation (OpenAI-compatible endpoint).
// Keys come from GEMINI_KEYS (comma-separated). Each request picks the next
// healthy key round-robin; on 429/403/503 the key is put on cooldown and the
// next key is tried. This multiplies the free-tier daily quota by N keys.
// ---------------------------------------------------------------------------

const BASE =
  env.llmBase ||
  "https://generativelanguage.googleapis.com/v1beta/openai";

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map((value) => value / norm);
}

function localEmbed(text: string, dims = 1536): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = (text.toLowerCase().match(/[a-z0-9+#.-]{2,}/g) ?? []).slice(0, 512);
  for (const token of tokens) {
    for (let seed = 0; seed < 4; seed++) {
      const h = hash32(`${token}|${seed}`);
      const idx = h % dims;
      const sign = ((h >>> 1) & 1) === 0 ? 1 : -1;
      vec[idx] += sign * (seed === 0 ? 1.5 : 1);
    }
  }
  const compact = text.toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < compact.length - 2 && i < 1200; i += 3) {
    const gram = compact.slice(i, i + 3);
    const h = hash32(`g:${gram}`);
    vec[h % dims] += ((h & 1) === 0 ? 0.35 : -0.35);
  }
  return normalize(vec);
}

type KeyState = { key: string; cooldownUntil: number; fails: number };
export type LlmProvider = "claude-proxy" | "gemini" | "bynara" | "atomesus";
type ChatOptions = {
  json?: boolean;
  temperature?: number;
  model?: "claude" | "gemini";
  maxTokens?: number;
  signal?: AbortSignal;
  onProvider?: (provider: LlmProvider, model: string) => void;
};

const KEYS: KeyState[] = (process.env.GEMINI_KEYS ?? env.llmKey ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean)
  .map((key) => ({ key, cooldownUntil: 0, fails: 0 }));

let cursor = 0;

// Admin-overridable gateway parameters (Admin → Settings → AI gateways).
// Resolved per call with a short in-process cache inside gateway-settings, so
// an owner edit applies within ~30s without a deploy. Falls back to env when
// no override exists.
async function geminiConnection() {
  const resolved = await resolveGateway("geminiKeys");
  return {
    keys: resolved?.apiKey
      ? resolved.apiKey.split(",").map((k) => k.trim()).filter(Boolean)
      : KEYS.map((k) => k.key),
    model: resolved?.model ?? env.llmModel,
    embedModel: resolved?.model && resolved.model !== env.llmModel ? resolved.model : env.embedModel,
    // Gemini's own override only. Borrowing the Claude proxy's base here
    // posted OpenAI-style /chat/completions at an Anthropic-format endpoint
    // (404 on every call, both keys) and silently degraded every generation
    // to the proxy fallback.
    baseUrl: resolved?.baseUrl,
  };
}

function applyGeminiKeys(keys: string[]) {
  if (keys.length === KEYS.length && keys.every((k, i) => k === KEYS[i]?.key)) return;
  KEYS.length = 0;
  for (const key of keys) KEYS.push({ key, cooldownUntil: 0, fails: 0 });
  cursor = 0;
}

function nextKey(now: number): KeyState | null {
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[(cursor + i) % KEYS.length];
    if (k.cooldownUntil <= now) {
      cursor = (cursor + i + 1) % KEYS.length;
      return k;
    }
  }
  return null; // all on cooldown
}

// Cooldown windows per failure class (ms).
const COOLDOWN: Record<number, number> = {
  429: 60_000, // rate limited — short rest
  403: 6 * 60 * 60_000, // project denied — long rest
  503: 5_000, // transient overload — brief
};

async function call(path: string, body: unknown, tries = KEYS.length * 2, signal?: AbortSignal): Promise<any> {
  // Pick up admin gateway overrides (key set, model, base URL) before each
  // call round. resolveGateway caches internally (~30s) so this is cheap.
  const conn = await geminiConnection();
  applyGeminiKeys(conn.keys);
  const baseUrl = conn.baseUrl ?? BASE;
  if (KEYS.length === 0) throw new Error("No GEMINI_KEYS configured");
  let lastErr = "no attempt";
  // Pure "all keys cooling" waits must NOT eat the real-attempt budget, or a
  // sustained outage burns through `tries` in milliseconds and gives up before
  // any key recovers. Track them separately with their own cap.
  let waits = 0;
  const maxWaits = KEYS.length * 4 + 4;
  for (let attempt = 0; attempt < tries; ) {
    const now = Date.now();
    const k = nextKey(now);
    if (!k) {
      const soonest = Math.min(...KEYS.map((s) => s.cooldownUntil));
      // Resume generation has downstream providers. If every Gemini key is
      // cooling for more than a moment, fail fast so Bynara/Atomesus receives
      // the request budget instead of spending ~36s polling known-bad keys.
      if (soonest - now > 1_000) break;
      if (++waits > maxWaits) break; // waited long enough; stop spinning
      await sleep(Math.max(250, Math.min(3000, soonest - now)));
      continue; // does not increment `attempt`
    }
    attempt++; // count only real request attempts
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${k.key}` },
        body: JSON.stringify(typeof body === "object" && body && "model" in body ? body : { ...(body as object), model: conn.model }),
        signal: deadlineSignal(LLM_REQUEST_TIMEOUT_MS, signal),
      });
    } catch (e: any) {
      // network/transport error — cool the key briefly and try the next one
      lastErr = e.message;
      k.cooldownUntil = Date.now() + 5_000;
      continue;
    }
    if (res.ok) {
      k.fails = 0;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        // 200 but non-JSON body (e.g. an HTML error page from an intermediary).
        // Surface distinctly — do NOT cool the key as if it were a key fault.
        throw new Error(`LLM bad-json (200, non-JSON body): ${text.slice(0, 160)}`);
      }
    }
    const cd = COOLDOWN[res.status] ?? 30_000;
    k.cooldownUntil = Date.now() + cd;
    k.fails++;
    lastErr = `key#${KEYS.indexOf(k)} -> ${res.status}`;
    if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 403) {
      // genuine bad request (e.g. 400) — don't burn every key, surface it
      const txt = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status}: ${txt.slice(0, 200)}`);
    }
  }
  throw new Error(`All Gemini keys exhausted (${KEYS.length} keys). Last: ${lastErr}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Call the antigravity-claude-proxy (Anthropic Messages format). The proxy
// handles multi-account rotation + ban-failover itself. Returns text or throws.
async function callProxy(
  messages: { role: string; content: string }[],
  opts?: { json?: boolean; temperature?: number; maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  const gw = await resolveGateway("claudeProxy");
  if (!gw?.baseUrl) throw new Error("proxy disabled by admin override");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const msgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  if (opts?.json && msgs.length) {
    msgs[msgs.length - 1].content += "\n\nRespond with ONLY valid JSON, no prose, no markdown fences.";
  }
  const res = await fetch(`${gw.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": gw.apiKey ?? env.proxyToken,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: gw.model ?? env.proxyModel,
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.4,
      ...(system ? { system } : {}),
      messages: msgs,
    }),
    signal: deadlineSignal(LLM_REQUEST_TIMEOUT_MS, opts?.signal),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j.content ?? []).map((b: any) => b.text ?? "").join("").trim();
}

// Generic OpenAI-compatible caller — shared by Bynara (Claude-class router)
// and Atomesus (last-resort credit-backed fallback).
async function callOpenAiCompat(
  name: string,
  base: string,
  key: string,
  model: string,
  messages: { role: string; content: string }[],
  opts?: { json?: boolean; temperature?: number; maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  if (!key) throw new Error(`no ${name} key`);
  const msgs = opts?.json
    ? messages.map((m, i) =>
        i === messages.length - 1
          ? { ...m, content: m.content + "\n\nRespond with ONLY valid JSON, no prose, no markdown fences." }
          : m,
      )
    : messages;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: msgs,
      temperature: opts?.temperature ?? 0.4,
      ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
    signal: deadlineSignal(LLM_REQUEST_TIMEOUT_MS, opts?.signal),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

const callBynara = async (m: { role: string; content: string }[], o?: { json?: boolean; temperature?: number; maxTokens?: number; signal?: AbortSignal }) => {
  const gw = await resolveGateway("bynara");
  if (!gw) throw new Error("bynara disabled by admin override");
  if (!gw.apiKey) throw new Error("no bynara key");
  return withBynaraRateLimit(o?.signal, () =>
    callOpenAiCompat("bynara", gw.baseUrl ?? env.bynaraBase, gw.apiKey!, gw.model ?? env.bynaraModel, m, o),
  );
};
const callAtomesus = async (m: { role: string; content: string }[], o?: { json?: boolean; temperature?: number; maxTokens?: number; signal?: AbortSignal }) => {
  const gw = await resolveGateway("atomesus");
  if (!gw) throw new Error("atomesus disabled by admin override");
  if (!gw.apiKey) throw new Error("no atomesus key");
  return callOpenAiCompat("atomesus", gw.baseUrl ?? env.atomesusBase, gw.apiKey, gw.model ?? env.atomesusModel, m, o);
};

// Bynara permits a configurable requests/minute (env BYNARA_RPM or the admin
// override). Space starts evenly instead of allowing a burst, which is safer
// with eight concurrent worker jobs and avoids provider-side 429s.
let bynaraNextStartAt = 0;
let bynaraIntervalMs = Math.ceil(60_000 / env.bynaraRpm);
async function refreshBynaraRpm() {
  const gw = await resolveGateway("bynara");
  if (gw?.rpm) bynaraIntervalMs = Math.ceil(60_000 / gw.rpm);
}
async function withBynaraRateLimit<T>(signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T> {
  await refreshBynaraRpm();
  const now = Date.now();
  const startAt = Math.max(now, bynaraNextStartAt);
  bynaraNextStartAt = startAt + bynaraIntervalMs;
  const delay = startAt - now;
  if (delay > 0) await abortableSleep(delay, signal);
  return run();
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error("Bynara wait aborted"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Bynara wait aborted"));
    };
    function done() {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function chat(
  messages: { role: string; content: string }[],
  opts?: ChatOptions,
) {
  // Provider chain (each tier falls through to the next on failure):
  //   1. Claude proxy    — best quality, premium tier only
  //   1b. Bynara router  — Claude-class, premium tier fallback for the proxy
  //   2. Gemini rotation — free-tier workhorse
  //   3. Bynara router   — general fallback when Gemini is exhausted
  //   4. Atomesus cipher — last-resort safety net (always-up, has credit)
  if (opts?.model === "claude") {
    if (env.proxyUrl) {
      try {
        const out = await callProxy(messages, opts);
        if (out) {
          opts?.onProvider?.("claude-proxy", env.proxyModel);
          return out;
        }
      } catch (e: any) {
        console.warn(`proxy failed, falling back: ${e.message}`);
      }
    }
    if (env.bynaraKey) {
      try {
        const out = await callBynara(messages, opts);
        if (out) {
          opts?.onProvider?.("bynara", env.bynaraModel);
          return out;
        }
      } catch (e: any) {
        console.warn(`bynara (premium) failed, falling back to Gemini: ${e.message}`);
      }
    }
  }
  try {
    const geminiModel = (await resolveGateway("geminiKeys"))?.model ?? env.llmModel;
    const body: any = { model: geminiModel, messages, temperature: opts?.temperature ?? 0.4 };
    if (opts?.json) body.response_format = { type: "json_object" };
    if (opts?.maxTokens) body.max_tokens = opts.maxTokens;
    const j = await call("/chat/completions", body, KEYS.length * 2, opts?.signal);
    const out = j.choices?.[0]?.message?.content ?? "";
    if (out) {
      opts?.onProvider?.("gemini", geminiModel);
      return out;
    }
    throw new Error("gemini empty response");
  } catch (e: any) {
    // The local Claude proxy is the most reliable emergency route on the VPS.
    // Let free resumes use it only after Gemini fails, so quota outages do not
    // force a 70-second timeout or a low-quality local fallback.
    if (env.proxyUrl && opts?.model !== "claude") {
      try {
        console.warn(`gemini failed, falling back to Claude proxy: ${e.message}`);
        const out = await callProxy(messages, opts);
        if (out) {
          opts?.onProvider?.("claude-proxy", env.proxyModel);
          return out;
        }
      } catch (proxyError: any) {
        console.warn(`Claude proxy fallback failed: ${proxyError.message}`);
      }
    }
    if (env.bynaraKey && opts?.model !== "claude") {
      try {
        console.warn(`gemini failed, falling back to Bynara: ${e.message}`);
        const out = await callBynara(messages, opts);
        if (out) {
          opts?.onProvider?.("bynara", env.bynaraModel);
          return out;
        }
      } catch (e2: any) {
        console.warn(`bynara failed: ${e2.message}`);
      }
    }
    if (!env.atomesusKey) throw e;
    console.warn(`falling back to Atomesus: ${e.message}`);
    const out = await callAtomesus(messages, opts);
    opts?.onProvider?.("atomesus", env.atomesusModel);
    return out;
  }
}

// allowLocalFallback=false makes provider failure THROW instead of returning a
// hash-based local vector. Local vectors live in a different space than real
// embeddings — comparing one against the other yields meaningless similarity,
// and writing one to the DB poisons the RAG corpus. Semantic matchers and the
// backfill script must therefore use strict mode; only ephemeral/dev paths may
// accept the local fallback.
export async function embed(text: string, opts?: { allowLocalFallback?: boolean }): Promise<number[]> {
  const allowLocalFallback = opts?.allowLocalFallback ?? true;
  const input = text.slice(0, 8000);
  if (KEYS.length === 0) {
    if (!allowLocalFallback) throw new Error("No GEMINI_KEYS configured (strict embed)");
    return localEmbed(input);
  }
  try {
    const j = await call("/embeddings", {
      model: env.embedModel,
      input,
      dimensions: 1536, // pgvector HNSW max is 2000; gemini default is 3072
    });
    return j.data[0].embedding;
  } catch (e: any) {
    if (!allowLocalFallback) throw e;
    console.warn(`embedding provider failed, using local fallback: ${e.message}`);
    return localEmbed(input);
  }
}

/** Admin-facing rotation health for the settings view. */
export async function gatewayHealth() {
  const gemini = await resolveGateway("geminiKeys");
  return {
    gemini: { ...keyStats(), model: gemini?.model ?? env.llmModel, configured: Boolean(gemini?.apiKey) },
  };
}

export function keyStats() {
  const now = Date.now();
  return {
    total: KEYS.length,
    available: KEYS.filter((k) => k.cooldownUntil <= now).length,
    cooling: KEYS.filter((k) => k.cooldownUntil > now).length,
  };
}
