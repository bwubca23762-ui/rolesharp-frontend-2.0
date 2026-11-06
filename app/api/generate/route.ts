import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { GenerateRequest } from "@/lib/types";
import { resumeQueue, admit } from "@/lib/queue";
import { getRoleBySlug, getCompanyBySlug, matchRoleByText, searchRoles, searchCompanies, matchCompanyByText } from "@/lib/db";
import { hasDb, q, saveResume } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getEntitlement, releaseGenerationReservation, reserveGeneration } from "@/lib/entitlements";
import { spendCredit } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { getDevCompanyBySlug, getDevRoleBySlug, saveDevResume } from "@/lib/local-dev-store";
import { localTailor } from "@/lib/local-tailor";
import { buildCompanyContext } from "@/lib/company-context";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "@/lib/legal";

export const runtime = "nodejs";

// Normalize a user-typed company/role: trim, collapse whitespace, drop a value
// that's actually a slug-looking blank or junk. Returns undefined if unusable.
function cleanName(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 120) return undefined;
  return s;
}

async function resolveRoleContext(data: GenerateRequest, localDevMode: boolean) {
  if (data.roleSlug) {
    return localDevMode ? getDevRoleBySlug(data.roleSlug) : getRoleBySlug(data.roleSlug).catch(() => null);
  }
  const rawRole = cleanName(data.roleTitleRaw);
  if (!rawRole || localDevMode) return null;

  try {
    const titleMatches = await searchRoles(rawRole, 5);
    const exact = titleMatches.find((role) => role.title.toLowerCase() === rawRole.toLowerCase());
    if (exact) return getRoleBySlug(exact.slug).catch(() => null);
    if (titleMatches[0] && titleMatches[0].title.toLowerCase().includes(rawRole.toLowerCase())) {
      return getRoleBySlug(titleMatches[0].slug).catch(() => null);
    }
  } catch {}

  try {
    const semantic = await matchRoleByText([rawRole, data.jdText ?? ""].filter(Boolean).join("\n\n"), 1);
    if (semantic[0] && semantic[0].score >= 0.72) {
      return {
        slug: semantic[0].slug,
        title: semantic[0].title,
        required_skills: semantic[0].required_skills ?? [],
        typical_bullets: semantic[0].typical_bullets ?? [],
      };
    }
  } catch {}

  return null;
}

async function resolveCompanyContext(data: GenerateRequest, localDevMode: boolean) {
  if (data.companySlug) {
    return localDevMode ? getDevCompanyBySlug(data.companySlug) : getCompanyBySlug(data.companySlug).catch(() => null);
  }
  const rawCompany = cleanName(data.companyNameRaw);
  if (!rawCompany || localDevMode) return null;

  try {
    const matches = await searchCompanies(rawCompany, 5);
    const exact = matches.find((company) => company.name.toLowerCase() === rawCompany.toLowerCase());
    if (exact) return getCompanyBySlug(exact.slug).catch(() => null);
    if (matches[0] && matches[0].name.toLowerCase().includes(rawCompany.toLowerCase())) {
      return getCompanyBySlug(matches[0].slug).catch(() => null);
    }
  } catch {}

  try {
    const semantic = await matchCompanyByText(rawCompany, 1);
    if (semantic[0] && semantic[0].score >= 0.74) {
      return semantic[0];
    }
  } catch {}

  return null;
}

export async function POST(reqHttp: NextRequest) {
  // Hard per-IP throttle on the most expensive endpoint (AI generation) BEFORE
  // any auth/DB work, so a flood can't burn CPU or model spend. Entitlement
  // limits still apply per-user below; this is the anti-abuse/DDoS backstop.
  const limited = await rateLimit(reqHttp, "generate", 8);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  // Login required to generate.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  try {
    await requireCurrentLegalAcceptance(user.id);
  } catch (error) {
    if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
    return NextResponse.json({ error: error.code, pending: error.pending }, { status: 403 });
  }

  const body = await reqHttp.json().catch(() => null);
  const parsed = GenerateRequest.safeParse(body);
  // String, not .flatten(): the client renders this into a <p> — an object
// child crashes React ("Objects are not valid as a React child").
if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  const data = parsed.data;

  // Tier: free and premium allowances both come from lib/env.ts; premium also
  // unlocks every premium feature.
  const ent = await getEntitlement(user);
  // Distinguish "email not verified" from "limit reached" so the UI can show
  // the right CTA (check inbox vs upgrade). Both gate generate at 402.
  if (!user.emailVerified) {
    return NextResponse.json({ error: "email_not_verified", email: user.email }, { status: 402 });
  }
  if (!ent.canGenerate) {
    return NextResponse.json({ error: "limit_reached", limit: ent.limit, period: ent.period, premium: ent.premium, upgrade: !ent.premium }, { status: 402 });
  }
  const template = ent.premium ? data.template : "basic";

  // The loopback preview seeds this account in its disposable database.
  // Generate through the existing local tailor without a queue or AI service.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.FRONTEND_REVIEW_MODE === "true" &&
    user.id === "00000000-0000-4000-8000-000000000001" &&
    user.email === process.env.FRONTEND_REVIEW_EMAIL &&
    env.siteUrl === "http://127.0.0.1:34110" &&
    reqHttp.headers.get("host") === "127.0.0.1:34110"
  ) {
    const role = data.roleSlug ? await getRoleBySlug(data.roleSlug) : null;
    const company = data.companySlug ? await getCompanyBySlug(data.companySlug) : null;
    const companyName = company?.name ?? cleanName(data.companyNameRaw);
    const result = localTailor(data, role, companyName, ent.premium);
    const resumeId = randomUUID();
    const saved = await saveResume({
      id: resumeId,
      userId: user.id,
      name: data.profile.name,
      content: result.content,
      atsScore: result.atsScore,
      template,
      jdText: data.jdText,
      roleId: role?.id,
      companyId: company?.id,
      genMs: 0,
      model: "local-review",
      premiumUnlock: ent.premium,
    });
    if (!saved) return NextResponse.json({ error: "Demo resume could not be saved" }, { status: 409 });
    return NextResponse.json({ resumeId, ...result, premium: ent.premium, premiumUnlock: ent.premium });
  }

  if (!env.localDevMode && !(await admit())) {
    return NextResponse.json({ error: "busy", retryAfter: 30 }, { status: 503, headers: { "Retry-After": "30" } });
  }

  // ── Double-fire shield (production only) ──
  // A double-click, a retried POST, or a second tab must never create a second
  // resume for one identical request. The claim key is derived from the user
  // and the exact parsed request, so an identical re-POST replays the first
  // outcome (same resumeId, one allowance slot) and any real edit mints a
  // fresh key. Same claim-row machinery /api/improve uses
  // (action_idempotency, migration 039).
  const requestHash = createHash("sha256").update(JSON.stringify({ u: user.id, r: data })).digest("hex");
  const dedupeKey = [
    requestHash.slice(0, 8), requestHash.slice(8, 12), requestHash.slice(12, 16),
    requestHash.slice(16, 20), requestHash.slice(20, 32),
  ].join("-");

  const resumeId = randomUUID();
  // Claim first: the pre-minted resumeId rides in the claim row, so a request
  // that loses the race still receives a pollable id. The conflict clause
  // re-claims a failed attempt; a live claim returns nothing (replay below).
  // DB-less dev has no claim table — the shield simply stays off there.
  let claimed: { idempotency_key: string } | undefined = { idempotency_key: resumeId };
  if (hasDb()) {
    claimed = (await q<{ idempotency_key: string }>(
      `insert into action_idempotency (user_id, action_kind, idempotency_key, request_hash, response)
       values ($1, 'generate', $2::uuid, $3, jsonb_build_object('resumeId', $4::text))
       on conflict (user_id, action_kind, idempotency_key) do update
         set request_hash = excluded.request_hash, updated_at = now()
         where action_idempotency.status = 'failed'
       returning idempotency_key`,
      [user.id, dedupeKey, requestHash, resumeId],
    ).catch(() => []))[0];

    if (!claimed) {
      const prior = (await q<{ status: string; updated_at: string; response: { resumeId?: string } | null }>(
        `select status, updated_at, response from action_idempotency
         where user_id = $1 and action_kind = 'generate' and idempotency_key = $2::uuid`,
        [user.id, dedupeKey],
      ))[0];
      const priorResumeId = prior?.response?.resumeId;
      if (!prior || prior.status === "failed" || !priorResumeId) {
        return NextResponse.json({ error: "busy", retryAfter: 5 }, { status: 503, headers: { "Retry-After": "5" } });
      }
      const saved = (await q<{ content: unknown | null; ats_score: number | null }>(
        "select content, ats_score from resumes where id = $1 and user_id = $2",
        [priorResumeId, user.id],
      ))[0];
      if (saved?.content != null) {
        // The identical request already produced a resume — hand back the same
        // one instead of creating a duplicate.
        return NextResponse.json({ resumeId: priorResumeId, content: saved.content, atsScore: saved.ats_score, replayed: true });
      }
      const ageMs = Date.now() - new Date(prior.updated_at).getTime();
      if (ageMs < 15 * 60_000) {
        // Queued or processing — poll the same resume, never a second generation.
        return NextResponse.json({ resumeId: priorResumeId, status: "processing", replayed: true }, { status: 202 });
      }
      // Stale claim with nothing to show for it (the resume was deleted, or the
      // trail went cold): release the claim so the next click can run fresh.
      await q(
        `delete from action_idempotency where user_id = $1 and action_kind = 'generate' and idempotency_key = $2::uuid`,
        [user.id, dedupeKey],
      ).catch(() => null);
      return NextResponse.json({ error: "busy", retryAfter: 5 }, { status: 503, headers: { "Retry-After": "5" } });
    }
  }

  // Trust the entitlement rather than re-deriving it. Re-deriving is what kept
  // students locked out of their own credits: they are premium, so a
  // `!ent.premium` test excluded them no matter what getEntitlement decided.
  const useCredit = ent.canUseCredit;
  const [role, company] = await Promise.all([
    resolveRoleContext(data, env.localDevMode),
    resolveCompanyContext(data, env.localDevMode),
  ]);
  const companyName = company?.name ?? cleanName(data.companyNameRaw) ?? undefined;
  const companyContext = company
    ? buildCompanyContext({
        name: company.name,
        sector: "sector" in company ? company.sector ?? undefined : undefined,
        ats_system: "ats_system" in company ? company.ats_system ?? undefined : undefined,
        ats_system_source_url: "ats_system_source_url" in company ? company.ats_system_source_url ?? undefined : undefined,
        ats_system_verified_at: "ats_system_verified_at" in company ? company.ats_system_verified_at ?? undefined : undefined,
        size_band: "size_band" in company ? company.size_band ?? undefined : undefined,
        style_profile: "style_profile" in company ? company.style_profile ?? undefined : undefined,
      })
    : null;
  const roleNorm = role
    ? { title: role.title, required_skills: role.required_skills, typical_bullets: role.typical_bullets }
    : (cleanName(data.roleTitleRaw) ? { title: cleanName(data.roleTitleRaw)!, required_skills: [], typical_bullets: [] } : null);

  if (env.localDevMode) {
    const creditEventId = useCredit ? await spendCredit(user.id, resumeId) : null;
    if (useCredit && !creditEventId) {
      return NextResponse.json({ error: "no_credits", upgrade: true }, { status: 402 });
    }
    const result = localTailor(data, roleNorm, companyName, ent.premium || useCredit, companyContext);
    await saveDevResume({
      id: resumeId,
      userId: user.id,
      candidateName: data.profile.name,
      content: result.content,
      atsScore: result.atsScore,
      template: useCredit ? data.template : template,
      premiumUnlock: ent.premium || useCredit,
      creditUsed: useCredit,
      jdText: data.jdText ?? "",
      companyName: companyName ?? null,
      roleTitle: roleNorm?.title ?? data.roleTitleRaw ?? null,
    });
    return NextResponse.json({
      resumeId,
      content: result.content,
      atsScore: result.atsScore,
      premium: ent.premium,
      premiumUnlock: ent.premium || useCredit,
      creditUsed: useCredit,
      remaining: useCredit ? 0 : Math.max(0, ent.remaining - 1),
      credits: Math.max(0, ent.credits - (useCredit ? 1 : 0)),
      period: ent.period,
    });
  }

  const reserved = !useCredit && await reserveGeneration(user.id, resumeId, ent.limit);
  if (!useCredit && !reserved) {
    await q(
      `delete from action_idempotency where user_id = $1 and action_kind = 'generate' and idempotency_key = $2::uuid`,
      [user.id, dedupeKey],
    ).catch(() => null);
    return NextResponse.json({ error: "limit_reached", limit: ent.limit, period: ent.period, premium: ent.premium, upgrade: !ent.premium }, { status: 402 });
  }

  let job;
  try {
    job = await resumeQueue.add(
      "gen",
      {
        req: { ...data, template: useCredit ? data.template : template },
        resumeId,
        template: useCredit ? data.template : template,
        userId: user.id,
        model: ent.model, // 'claude' | 'gemini'
        premium: ent.premium, // gates the ATS-optimization second pass
        premiumUnlock: ent.premium || useCredit,
        useCredit,
        creditEventId: null,
        role: roleNorm,
        companyContext,
        // Prefer the matched DB name; fall back to the user's typed company so a
        // custom employer still reaches the LLM as a real name, not "(generic)".
        companyName,
        companyId: company?.id ?? null,
        roleId: role?.id ?? null,
      },
      {
        jobId: resumeId,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2,
        backoff: { type: "exponential", delay: 1500 },
      },
    );
  } catch (error) {
    if (reserved) {
      await releaseGenerationReservation(user.id, resumeId).catch(() => false);
    }
    await q(
      `delete from action_idempotency where user_id = $1 and action_kind = 'generate' and idempotency_key = $2::uuid`,
      [user.id, dedupeKey],
    ).catch(() => null);
    console.error("[generate] queue admission failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "queue_unavailable", retryAfter: 30 }, { status: 503, headers: { "Retry-After": "30" } });
  }

  // The client already polls the resume endpoint. Returning immediately avoids
  // holding a web connection (and a QueueEvents subscriber) for up to 90s.
  return NextResponse.json(
    {
      resumeId,
      jobId: job.id,
      status: "processing",
      premium: ent.premium,
      premiumUnlock: ent.premium || useCredit,
      creditUsed: useCredit,
      remaining: useCredit ? 0 : Math.max(0, ent.remaining - 1),
      credits: Math.max(0, ent.credits - (useCredit ? 1 : 0)),
      period: ent.period,
    },
    { status: 202 },
  );
}
