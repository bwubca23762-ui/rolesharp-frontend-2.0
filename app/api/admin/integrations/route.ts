import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { connection } from "@/lib/queue";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// GET /api/admin/integrations — health check for all external integrations.
export async function GET() {
  if (!(await hasAdminPermission("system.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const results: Record<string, any> = {};

  // a) Database
  try {
    await q("select 1");
    results.database = { ok: true };
  } catch (e: any) {
    results.database = { ok: false, error: e?.message ?? String(e) };
  }

  // b) Redis
  try {
    const start = Date.now();
    const pong = await connection.ping();
    const latency_ms = Date.now() - start;
    results.redis = { ok: pong === "PONG", latency_ms };
  } catch (e: any) {
    results.redis = { ok: false, error: e?.message ?? String(e) };
  }

  // c) Transactional email. A loopback Postfix relay can accept mail while
  // remote providers later reject it, so "configured" is not the same as
  // production-ready delivery.
  const cloudflareEmail = !!(env.cloudflareAccountId && env.cloudflareEmailApiToken && env.smtpFrom);
  const directLocalSmtp = ["127.0.0.1", "localhost", "::1"].includes(env.smtpHost.trim().toLowerCase());
  results.smtp = {
    configured: cloudflareEmail || !!(env.smtpHost && env.smtpFrom),
    provider: cloudflareEmail ? "cloudflare_email" : directLocalSmtp ? "local_postfix" : env.smtpHost ? "smtp_relay" : "none",
    production_ready: cloudflareEmail || (!!env.smtpHost && !directLocalSmtp),
    warning: directLocalSmtp ? "Direct VPS delivery is vulnerable to IP reputation and DMARC rejection. Configure an authenticated transactional relay." : null,
    host: env.smtpHost || null,
    port: env.smtpPort,
  };

  // d) Google OAuth
  results.google_oauth = {
    configured: !!(env.googleClientId && env.googleClientSecret),
  };

  // e) NOWPayments
  results.nowpayments = {
    mode: env.localDevMode && !process.env.NOWPAYMENTS_API_KEY ? "dev" : (process.env.NOWPAYMENTS_API_KEY ? "live" : "off"),
    api_key_set: !!process.env.NOWPAYMENTS_API_KEY,
    ipn_secret_set: !!process.env.NOWPAYMENTS_IPN_SECRET,
  };

  // f) LLM Proxy (Anthropic proxy)
  results.llm_proxy = {
    url: env.proxyUrl || null,
    configured: !!env.proxyUrl,
  };

  // g) Gemini / LLM keys
  const geminiKeys = (process.env.GEMINI_KEYS ?? env.llmKey ?? "").split(",").filter(Boolean);
  results.gemini_keys = {
    configured: geminiKeys.length > 0,
    provider_count: geminiKeys.length,
  };

  return NextResponse.json(results);
}
