import { q } from "./db";
import { env } from "./env";

// Owner-editable LLM gateway overrides, stored in admin_settings (key
// "llm_gateways"). The .env file remains the bootstrap/fallback: a gateway
// with no DB override uses its env value, so the platform still starts on a
// fresh VPS. Overrides exist because Bynara died mid-life and Atomesus
// credits expired — both were env-only and needed a deploy + SSH session to
// change. Now the owner edits them from Admin → Settings → AI gateways.
//
// SECURITY: keys are write-only through the API. GET returns presence and a
// masked tail, never the full key.

export type GatewayId = "claudeProxy" | "bynara" | "geminiKeys" | "atomesus";

export type GatewayConfig = {
  /** Base URL of an OpenAI-compatible endpoint (or proxy root for claudeProxy). */
  baseUrl?: string;
  /** Secret — write-only. */
  apiKey?: string;
  model?: string;
  /** Bynara only: requests per minute the provider allows. */
  rpm?: number;
};

export type GatewaySettings = Partial<Record<GatewayId, GatewayConfig>>;

const SETTINGS_KEY = "llm_gateways";
const CACHE_TTL_MS = 30_000;
let cache: { expiresAt: number; settings: GatewaySettings } | null = null;

export const GATEWAY_IDS: readonly GatewayId[] = ["claudeProxy", "bynara", "geminiKeys", "atomesus"];

function str(value: unknown, max = 300): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Env values each gateway falls back to when no DB override exists. */
export function envGatewayConfig(id: GatewayId): GatewayConfig {
  switch (id) {
    case "claudeProxy":
      return { baseUrl: env.proxyUrl, model: env.proxyModel, ...(env.proxyToken ? { apiKey: "•••(env)" } : {}) };
    case "bynara":
      return { baseUrl: env.bynaraBase, model: env.bynaraModel, rpm: env.bynaraRpm, ...(env.bynaraKey ? { apiKey: "•••(env)" } : {}) };
    case "geminiKeys":
      // Comma-separated list lives in one string field.
      return { apiKey: process.env.GEMINI_KEYS ? "•••(env)" : undefined, model: env.llmModel };
    case "atomesus":
      return { baseUrl: env.atomesusBase, model: env.atomesusModel, ...(env.atomesusKey ? { apiKey: "•••(env)" } : {}) };
  }
}

function sanitizeGateway(input: unknown): GatewayConfig {
  const value = (input ?? {}) as Record<string, unknown>;
  const out: GatewayConfig = {};
  const baseUrl = str(value.baseUrl);
  if (baseUrl) {
    // Only http(s) URLs — this string is concatenated into fetch calls.
    if (/^https?:\/\//i.test(baseUrl)) out.baseUrl = baseUrl;
  }
  const apiKey = str(value.apiKey, 400);
  // Masked tails ("•••(env)") are UI echo, never stored as real keys.
  if (apiKey && !apiKey.startsWith("•••")) out.apiKey = apiKey;
  const model = str(value.model, 120);
  if (model) out.model = model;
  const rpm = Math.trunc(Number(value.rpm));
  if (Number.isFinite(rpm)) out.rpm = Math.min(10_000, Math.max(1, rpm));
  return out;
}

export function sanitizeGatewaySettings(input: unknown): GatewaySettings {
  const value = (input ?? {}) as Record<string, unknown>;
  const out: GatewaySettings = {};
  for (const id of GATEWAY_IDS) {
    if (value[id] && typeof value[id] === "object") {
      const cfg = sanitizeGateway(value[id]);
      if (Object.keys(cfg).length > 0) out[id] = cfg;
    }
  }
  return out;
}

/** Effective config for a gateway: DB override wins per-field, env fills gaps. */
export async function getGatewaySettings(): Promise<GatewaySettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.settings;
  try {
    const row = (await q<{ value: unknown }>("select value from admin_settings where key=$1", [SETTINGS_KEY]))[0];
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, settings: sanitizeGatewaySettings(row?.value) };
  } catch {
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, settings: {} };
  }
  return cache.settings;
}

export async function setGatewaySettings(settings: GatewaySettings, updatedBy: string | null): Promise<void> {
  await q(
    `insert into admin_settings (key, value, updated_at, updated_by)
     values ($1, $2::jsonb, now(), $3)
     on conflict (key) do update
       set value=excluded.value, updated_at=now(), updated_by=excluded.updated_by`,
    [SETTINGS_KEY, JSON.stringify(settings), updatedBy],
  );
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, settings };
}

/**
 * Resolve the live connection parameters lib/llm.ts should use right now.
 * Returns null for a gateway whose override disables it (empty object).
 */
export async function resolveGateway(id: GatewayId): Promise<{ baseUrl?: string; apiKey?: string; model?: string; rpm?: number } | null> {
  const settings = await getGatewaySettings();
  const override = settings[id];
  const base = envGatewayConfig(id);

  // Explicit disable: an override object present but with every field cleared
  // means "stop using this gateway". Represented as null here.
  if (override && Object.keys(override).length === 0) return null;

  const merged = {
    baseUrl: override?.baseUrl ?? base.baseUrl,
    model: override?.model ?? base.model,
    rpm: override?.rpm ?? base.rpm,
  };
  let apiKey = override?.apiKey ?? undefined;
  if (!apiKey && !base.apiKey) {
    // No override key and env has none: read the raw env directly (masked in
    // envGatewayConfig to keep it out of API responses).
    if (id === "claudeProxy") apiKey = env.proxyToken || undefined;
    else if (id === "bynara") apiKey = env.bynaraKey || undefined;
    else if (id === "atomesus") apiKey = env.atomesusKey || undefined;
    else if (id === "geminiKeys") apiKey = process.env.GEMINI_KEYS || env.llmKey || undefined;
  } else if (!apiKey) {
    if (id === "claudeProxy") apiKey = env.proxyToken || undefined;
    else if (id === "bynara") apiKey = env.bynaraKey || undefined;
    else if (id === "atomesus") apiKey = env.atomesusKey || undefined;
    else if (id === "geminiKeys") apiKey = process.env.GEMINI_KEYS || env.llmKey || undefined;
  }
  return { ...merged, apiKey };
}
