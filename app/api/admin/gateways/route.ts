import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { rateLimit } from "@/lib/rate-limit";
import {
  envGatewayConfig,
  getGatewaySettings,
  GATEWAY_IDS,
  sanitizeGatewaySettings,
  setGatewaySettings,
  type GatewayId,
} from "@/lib/gateway-settings";
import { keyStats } from "@/lib/llm";
import { env } from "@/lib/env";
import { razorpayConfigured } from "@/lib/razorpay";
import { now } from "@/lib/nowpay";

export const runtime = "nodejs";

function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  // Show provider + last 4 so the owner can tell which credential is live
  // without the API ever returning a usable secret.
  const tail = key.slice(-4);
  return `••••${tail}`;
}

// GET /api/admin/gateways — per-gateway effective config, env fallbacks, and
// rotation health. Keys are masked; full keys are write-only.
export async function GET() {
  try {
    await requireAdminPermission("system.read");
    const overrides = await getGatewaySettings();
    const gateways = GATEWAY_IDS.map((id) => {
      const envCfg = envGatewayConfig(id);
      const override = overrides[id];
      return {
        id,
        overridden: Boolean(override),
        envBaseUrl: envCfg.baseUrl ?? null,
        envModel: envCfg.model ?? null,
        envRpm: envCfg.rpm ?? null,
        hasEnvKey: Boolean(envCfg.apiKey) || (id === "geminiKeys" ? Boolean(process.env.GEMINI_KEYS || process.env.OPENAI_API_KEY) : false),
        override: override
          ? {
              baseUrl: override.baseUrl ?? null,
              model: override.model ?? null,
              rpm: override.rpm ?? null,
              keyTail: override.apiKey ? maskKey(override.apiKey) : null,
            }
          : null,
      };
    });
    return NextResponse.json({ gateways, geminiRotation: keyStats(), payments: [
      { id: "razorpay", name: "Razorpay", configured: razorpayConfigured(), mode: env.razorpayKeyId?.startsWith("rzp_live_") ? "Live" : env.razorpayKeyId?.startsWith("rzp_test_") ? "Test" : "Off", currency: env.razorpayCurrency, confirmation: "Server-side signature verification", verificationConfigured: Boolean(env.razorpayKeySecret) },
      { id: "nowpayments", name: "NOWPayments", configured: now.live, mode: now.live ? "Live" : now.dev ? "Development" : "Off", currency: "USD", confirmation: "Signed payment webhook", verificationConfigured: Boolean(now.ipnSecret) },
    ] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

// PUT /api/admin/gateways — save overrides. An empty object for a gateway
// clears its override (back to env). Fields left absent keep their current value.
export async function PUT(req: NextRequest) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-gateways", 20);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const actor = await requireAdminPermission("system.manage");
    const body = await req.json().catch(() => ({}));

    if (body?.reset === true) {
      const id = typeof body.id === "string" ? body.id : "";
      if (!GATEWAY_IDS.includes(id as GatewayId)) return NextResponse.json({ error: "unknown gateway" }, { status: 400 });
      const current = await getGatewaySettings();
      delete current[id as GatewayId];
      await setGatewaySettings(current, actor.email ?? null);
      await q(
        `insert into admin_actions (action, target_email, details, staff_account_id, authentication_method)
         values ('gateway_reset', $1, $2, $3, $4)`,
        [actor.email, JSON.stringify({ gateway: id }), actor.staffAccountId, actor.authenticationMethod],
      ).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const incoming = sanitizeGatewaySettings(body?.gateways);
    if (Object.keys(incoming).length === 0 && !body?.clear) {
      return NextResponse.json({ error: "No valid gateway changes supplied." }, { status: 400 });
    }

    // Merge with stored overrides: PUT is per-field. A field set to "" clears
    // it back to env; absent fields stay untouched.
    const current = await getGatewaySettings();
    for (const [id, cfg] of Object.entries(incoming) as Array<[GatewayId, Record<string, unknown>]>) {
      const merged = { ...(current[id] ?? {}) };
      for (const [field, value] of Object.entries(cfg)) {
        // sanitizeGatewaySettings already validated shape; empty strings mean clear.
        if (value === "") delete merged[field as keyof typeof merged];
        else (merged as Record<string, unknown>)[field] = value;
      }
      current[id] = merged;
    }
    await setGatewaySettings(current, actor.email ?? null);

    await q(
      `insert into admin_actions (action, target_email, details, staff_account_id, authentication_method)
       values ('gateway_update', $1, $2, $3, $4)`,
      [actor.email, JSON.stringify(Object.fromEntries(Object.entries(incoming).map(([id, cfg]) => [id, Object.keys(cfg)]))), actor.staffAccountId, actor.authenticationMethod],
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "gateway_update_failed";
    if (code === "staff_permission_required") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error("gateway_update_failed", { error: code });
    return NextResponse.json({ error: "gateway_update_failed" }, { status: 500 });
  }
}
