import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { hasAdminPermission } from "@/lib/admin-authorization";
import {
  PRODUCT_EVENT_NAMES,
  normalizeAnalyticsPath,
  pageFamilyForPath,
  sanitizeAnalyticsContext,
} from "@/lib/product-analytics";

export const runtime = "nodejs";

const MAX_ANALYTICS_BODY_BYTES = 2_048;
const PageView = z.object({
  type: z.literal("page_view").optional(),
  path: z.string().min(1).max(500).startsWith("/"),
  sessionId: z.string().uuid(),
}).strict();

const ProductEvent = z.object({
  type: z.literal("event"),
  event: z.enum(PRODUCT_EVENT_NAMES),
  path: z.string().min(1).max(240),
  pageFamily: z.enum(["marketing", "tool", "auth", "workspace", "directory", "editorial", "legal", "unknown"]),
  deviceClass: z.enum(["mobile", "tablet", "desktop"]),
  authState: z.enum(["anonymous", "authenticated", "unknown"]),
  sessionId: z.string().uuid(),
  context: z.string().max(80).optional(),
}).strict();

function declaredBodyTooLarge(req: NextRequest) {
  const value = req.headers.get("content-length");
  if (!value) return false;
  const length = Number(value);
  return !Number.isFinite(length) || length < 0 || length > MAX_ANALYTICS_BODY_BYTES;
}

// Lightweight same-origin page-view tracker. Payload and request volume are
// bounded before database insertion to prevent anonymous data poisoning/growth.
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "analytics", 120, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }
    if (declaredBodyTooLarge(req)) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_ANALYTICS_BODY_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
    const productEvent = ProductEvent.safeParse(json);
    const pageView = PageView.safeParse(json);
    if (!productEvent.success && !pageView.success) {
      return NextResponse.json({ error: "invalid_event" }, { status: 400 });
    }

    const eventData = productEvent.success ? productEvent.data : null;
    const pageViewData = pageView.success ? pageView.data : null;
    const path = normalizeAnalyticsPath(eventData?.path ?? pageViewData?.path ?? "");
    if (!path) return NextResponse.json({ error: "invalid_path" }, { status: 400 });
    if (
      path.startsWith("/api/") ||
      path.startsWith("/_next/") ||
      path.startsWith("/admin") ||
      path === "/track"
    ) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const country = (req.headers.get("cf-ipcountry") ?? "").toUpperCase().slice(0, 2) || null;
    const ua = req.headers.get("user-agent") ?? "";
    if (/bot|crawler|spider|scraper|curl|wget|headless|selenium|puppeteer|playwright/i.test(ua)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { q } = await import("@/lib/db");
    if (eventData) {
      const context = sanitizeAnalyticsContext(eventData.context);
      // Page family is derived again on the server so clients cannot relabel
      // routes and distort family-level reporting.
      const pageFamily = pageFamilyForPath(path);
      await q(
        `insert into product_events (
           event_name, path, page_family, device_class, auth_state,
           context_key, country_code, session_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          eventData.event,
          path,
          pageFamily,
          eventData.deviceClass,
          eventData.authState,
          context ?? null,
          country,
          eventData.sessionId,
        ],
      );
      return NextResponse.json({ ok: true });
    }

    if (!pageViewData) {
      return NextResponse.json({ error: "invalid_event" }, { status: 400 });
    }

    const deviceType = /Mobi|Android.*Mobile|iPhone/i.test(ua)
      ? "mobile"
      : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
    // Legacy page views retain aggregate route/device/country measurement. Raw
    // referrer and user-agent storage is intentionally disabled for new rows.
    await q(
      `insert into page_views (path, referrer, country_code, device_type, session_id, user_agent)
       values ($1, null, $2, $3, $4, null)`,
      [path, country, deviceType, pageViewData.sessionId],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[analytics:ingest]", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "analytics_unavailable" }, { status: 503 });
  }
}

// Admin stats endpoint — summarizes traffic data for the dashboard.
export async function GET() {
  try {
    // Scoped RBAC, not the blanket admin cookie: analytics staff get this
    // without holding full system access.
    if (!(await hasAdminPermission("analytics.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
    const { q } = await import("@/lib/db");
    const [summaries, dailyTrend, topPages, devices, countries, referrers, hourly] = await Promise.all([
      q<{
        today_views: string; today_visitors: string; week_views: string;
        week_visitors: string; month_views: string; month_visitors: string;
      }>(
        `select
           count(*) filter (where created_at >= date_trunc('day', now()))::text as today_views,
           count(distinct session_id) filter (where created_at >= date_trunc('day', now()))::text as today_visitors,
           count(*) filter (where created_at >= now() - interval '7 days')::text as week_views,
           count(distinct session_id) filter (where created_at >= now() - interval '7 days')::text as week_visitors,
           count(*)::text as month_views,
           count(distinct session_id)::text as month_visitors
         from page_views where created_at >= now() - interval '30 days'`,
      ),
      q<{ d: string; views: string; visitors: string }>(
        `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') d,
                count(*)::text views, count(distinct session_id)::text visitors
         from page_views where created_at >= now() - interval '30 days'
         group by date_trunc('day', created_at) order by d`,
      ),
      q<{ path: string; views: string }>(
        `select path,count(*)::text views from page_views
         where created_at >= now() - interval '30 days'
         group by path order by count(*) desc limit 30`,
      ),
      q<{ device_type: string; views: string }>(
        `select device_type,count(*)::text views from page_views
         where created_at >= now() - interval '30 days'
         group by device_type order by count(*) desc`,
      ),
      q<{ country_code: string; views: string }>(
        `select coalesce(country_code,'??') country_code,count(*)::text views from page_views
         where created_at >= now() - interval '30 days'
         group by country_code order by count(*) desc limit 20`,
      ),
      q<{ referrer: string; views: string }>(
        `select coalesce(referrer,'Direct / None') referrer,count(*)::text views from page_views
         where created_at >= now() - interval '30 days'
         group by referrer order by count(*) desc limit 15`,
      ),
      q<{ h: string; views: string }>(
        `select to_char(date_trunc('hour', created_at),'HH24:00') h,count(*)::text views
         from page_views where created_at >= date_trunc('day', now())
         group by date_trunc('hour', created_at) order by h`,
      ),
    ]);
    const summary = summaries[0];
    return NextResponse.json({
      today: { views: Number(summary?.today_views ?? 0), visitors: Number(summary?.today_visitors ?? 0) },
      last7Days: { views: Number(summary?.week_views ?? 0), visitors: Number(summary?.week_visitors ?? 0) },
      last30Days: { views: Number(summary?.month_views ?? 0), visitors: Number(summary?.month_visitors ?? 0) },
      dailyTrend: dailyTrend.map((r) => ({ d: r.d, views: Number(r.views), visitors: Number(r.visitors) })),
      topPages: topPages.map((r) => ({ path: r.path, views: Number(r.views) })),
      devices: devices.map((r) => ({ type: r.device_type, views: Number(r.views) })),
      countries: countries.map((r) => ({ code: r.country_code, views: Number(r.views) })),
      referrers: referrers.map((r) => ({ source: r.referrer, views: Number(r.views) })),
      hourly: hourly.map((r) => ({ hour: r.h, views: Number(r.views) })),
    });
  } catch (error) {
    console.error("[analytics]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
