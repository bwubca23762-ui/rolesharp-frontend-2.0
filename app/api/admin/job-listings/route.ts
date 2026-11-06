import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { boundedPage, boundedPageSize, boundedSearch, containsLikePattern } from "@/lib/sql-search";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// GET /api/admin/job-listings — manage the job search index + ingestion profiles.
// ?provider= drives the multi-board source health view ("admin" = manual rows).
export async function GET(req: NextRequest) {
  if (!(await hasAdminPermission("jobs.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const query = boundedSearch(url.searchParams.get("q"));
  const country = (url.searchParams.get("country") || "").trim().toLowerCase();
  const provider = (url.searchParams.get("provider") || "").trim().toLowerCase().slice(0, 40);
  const page = boundedPage(url.searchParams.get("page"));
  const pageSize = boundedPageSize(url.searchParams.get("pageSize"));

  const conds: string[] = [];
  const params: any[] = [];
  if (query) {
    params.push(containsLikePattern(query));
    conds.push(`(title ilike $${params.length} escape '\\' or company ilike $${params.length} escape '\\')`);
  }
  if (country) {
    params.push(country);
    conds.push(`lower(country_code) = $${params.length}`);
  }
  if (provider) {
    params.push(provider);
    conds.push(`lower(provider) = $${params.length}`);
  }
  const where = conds.length ? `where ${conds.join(" and ")}` : "";

  const [stats, countries, providerHealth, profiles, totalRow, rows] = await Promise.all([
    q<{ total: string; fresh24: string; expiring7: string; remote: string }>(
      `select count(*)::text as total,
              count(*) filter (where last_seen_at > now() - interval '24 hours')::text as fresh24,
              count(*) filter (where expires_at < now() + interval '7 days')::text as expiring7,
              count(*) filter (where is_remote)::text as remote
       from jobs`,
    ),
    q<{ code: string; n: string }>(
      "select lower(country_code) as code, count(*)::text as n from jobs group by 1 order by count(*) desc limit 20",
    ),
    q<{ provider: string; n: string; fresh24: string; last_seen: string | null }>(
      `select provider, count(*)::text as n,
              count(*) filter (where last_seen_at > now() - interval '24 hours')::text as fresh24,
              max(last_seen_at)::text as last_seen
       from jobs group by provider order by count(*) desc limit 24`,
    ),
    q<any>(
      `select id, country_code, country_name, search_term, enabled, refresh_hours,
              next_run_at, last_success_at, last_error, consecutive_failures
       from job_search_profiles order by country_code, search_term limit 200`,
    ),
    q<{ n: string }>(`select count(*)::text as n from jobs ${where}`, params),
    q<any>(
      `select id, provider, title, company, country_code, location, is_remote, job_type,
              date_posted, last_seen_at, expires_at, apply_url
       from jobs ${where}
       order by last_seen_at desc
       limit ${pageSize} offset ${(page - 1) * pageSize}`,
      params,
    ),
  ]);

  return NextResponse.json({
    stats: stats[0] || {},
    countries,
    providerHealth,
    profiles,
    total: Number(totalRow[0]?.n || 0),
    rows,
  });
}

// POST /api/admin/job-listings — profile management + maintenance.
//   { action: "toggleProfile", id }   → enable/disable an ingestion profile
//   { action: "runProfile", id }      → schedule a profile to run now
//   { action: "purgeExpired" }        → delete listings past expiry
//   { action: "quickAdd", listing }   → insert one manual listing (provider "admin")
//   { action: "bulkImport", listings }→ insert up to 200 listings from JSON
const AdminListing = z.object({
  title: z.string().min(2).max(300),
  company: z.string().min(1).max(300),
  country_code: z.string().trim().length(2),
  location: z.string().max(300).optional(),
  job_type: z.string().max(40).optional(),
  is_remote: z.boolean().optional(),
  apply_url: z.string().url().max(1500).refine((u) => /^https:\/\//i.test(u), { message: "apply_url must be https" }),
  salary_min: z.number().nonnegative().optional(),
  salary_max: z.number().nonnegative().optional(),
  salary_currency: z.string().max(12).optional(),
  description: z.string().max(40_000).optional(),
});

function adminExternalId(listing: { title: string; company: string; apply_url: string }): string {
  return createHash("sha256")
    .update(`${listing.company.toLowerCase()}:${listing.title.toLowerCase()}:${listing.apply_url}`)
    .digest("hex")
    .slice(0, 40);
}

async function insertAdminListing(listing: z.infer<typeof AdminListing>): Promise<boolean> {
  const rows = await q<{ id: string }>(
    `insert into jobs (
       provider, external_id, title, company, country_code, location, is_remote, job_type,
       description, apply_url, source_url, salary_min, salary_max, salary_currency,
       salary_interval, date_posted, last_seen_at, expires_at, metadata
     ) values (
       'admin', $1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12, 'yearly',
       now(), now(), now() + interval '30 days', '{"source":"admin_manual"}'::jsonb
     )
     on conflict (provider, external_id) do update set
       title=excluded.title, last_seen_at=now(), expires_at=excluded.expires_at
     returning id`,
    [
      adminExternalId(listing),
      listing.title,
      listing.company,
      listing.country_code.toUpperCase(),
      listing.location ?? null,
      listing.is_remote ?? false,
      listing.job_type ?? null,
      listing.description ?? null,
      listing.apply_url,
      listing.salary_min ?? null,
      listing.salary_max ?? null,
      listing.salary_currency ?? null,
    ],
  ).catch(() => []);
  return rows.length > 0;
}

export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("jobs.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-job-listings", 30);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  // The body is read exactly once — a second req.json() on the same request
  // stream throws "Body is unusable" and every quickAdd/bulkImport 400s.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { action, id, listing, listings } = body;

  if ((action === "toggleProfile" || action === "runProfile")
      && (!Number.isSafeInteger(Number(id)) || Number(id) < 1)) {
    return NextResponse.json({ error: "invalid_profile_id" }, { status: 400 });
  }

  if (action === "toggleProfile") {
    const row = (await q<{ enabled: boolean }>(
      "update job_search_profiles set enabled = not enabled where id = $1 returning enabled",
      [Number(id)],
    ))[0];
    if (!row) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    await logAction("job_profile_toggle", { id, enabled: row.enabled });
    return NextResponse.json({ ok: true, enabled: row.enabled });
  }

  if (action === "runProfile") {
    const row = (await q<{ id: number }>(
      "update job_search_profiles set next_run_at = now() where id = $1 returning id",
      [Number(id)],
    ))[0];
    if (!row) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    await logAction("job_profile_run_now", { id });
    return NextResponse.json({ ok: true });
  }

  if (action === "purgeExpired") {
    const rows = await q<{ id: string }>("delete from jobs where expires_at < now() returning id");
    await logAction("jobs_purge_expired", { removed: rows.length });
    return NextResponse.json({ ok: true, removed: rows.length });
  }

  if (action === "quickAdd") {
    const parsed = AdminListing.safeParse(listing);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid_listing" }, { status: 400 });
    }
    const ok = await insertAdminListing(parsed.data);
    if (!ok) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    await logAction("job_listing_quick_add", { title: parsed.data.title, company: parsed.data.company });
    return NextResponse.json({ ok: true });
  }

  if (action === "bulkImport") {
    const raw = listings;
    if (!Array.isArray(raw) || raw.length === 0) return NextResponse.json({ error: "listings_required" }, { status: 400 });
    if (raw.length > 200) return NextResponse.json({ error: "max_200_per_import" }, { status: 400 });
    let inserted = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];
    for (const [index, item] of raw.entries()) {
      const parsed = AdminListing.safeParse(item);
      if (!parsed.success) {
        skipped += 1;
        if (skippedReasons.length < 5) skippedReasons.push(`row ${index + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
        continue;
      }
      if (await insertAdminListing(parsed.data)) inserted += 1;
      else skipped += 1;
    }
    await logAction("job_listing_bulk_import", { inserted, skipped });
    return NextResponse.json({ ok: true, inserted, skipped, skippedReasons });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

// DELETE /api/admin/job-listings?id=... — remove a single listing.
export async function DELETE(req: NextRequest) {
  if (!(await hasAdminPermission("jobs.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const rows = await q<{ id: string }>("delete from jobs where id = $1 returning id", [id]);
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await logAction("job_listing_delete", { id });
  return NextResponse.json({ ok: true });
}

// One audit write per action with staff attribution — this route previously
// double-wrote (raw "system"-attributed row + recordAdminAction row).
async function logAction(action: string, details: any) {
  await recordAdminAction(action, { details }).catch(() => {});
}
