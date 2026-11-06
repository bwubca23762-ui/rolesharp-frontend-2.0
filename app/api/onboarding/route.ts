import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { listDevUserResumes } from "@/lib/local-dev-store";
import { grantCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dashboard activation checklist (gap report Tier B, the Whali-proven
// pattern): four steps that map to the product's real loop — save, tailor,
// track — then a one-time +1 credit. Every step is derived from actual
// account state, never from clicks on the checklist itself, so the
// checklist cannot be advanced by pretending. The claim is idempotent via
// the credit_events_onboarding_once partial unique index.

type Status = {
  accountCreated: true;
  savedResume: boolean;
  tailoredToCompany: boolean;
  trackedApplication: boolean;
  bonusClaimed: boolean;
  complete: boolean;
};

async function buildStatus(userId: string): Promise<Status> {
  if (env.localDevMode) {
    // Local dev keeps it simple: derive steps from the dev store's resumes
    // (applications live in Postgres only, so the dev store shows step 2-3
    // state); the claim path still guards on the real checklist in prod.
    const resumes = await listDevUserResumes(userId);
    const saved = resumes.length > 0;
    const tailored = resumes.some((r) => Boolean((r as { company_name?: string }).company_name));
    return { accountCreated: true, savedResume: saved, tailoredToCompany: tailored, trackedApplication: false, bonusClaimed: false, complete: false };
  }
  const [resumeRows, appRows, claimRows] = await Promise.all([
    q<{ saved: boolean; tailored: boolean }>(
      `select count(*) > 0 as saved,
              count(*) filter (where company_id is not null or (jd_text is not null and length(jd_text) > 0) or (content->>'targetCompany') is not null) > 0 as tailored
       from resumes where user_id_text=$1`,
      [userId],
    ),
    q<{ tracked: boolean }>(
      "select count(*) > 0 as tracked from applications where user_id_text=$1",
      [userId],
    ),
    q<{ id: number }>(
      "select id from credit_events where user_id=$1 and kind='onboarding_checklist' limit 1",
      [userId],
    ),
  ]);
  const savedResume = Boolean(resumeRows[0]?.saved);
  const tailoredToCompany = Boolean(resumeRows[0]?.tailored);
  const trackedApplication = Boolean(appRows[0]?.tracked);
  const bonusClaimed = claimRows.length > 0;
  return {
    accountCreated: true,
    savedResume,
    tailoredToCompany,
    trackedApplication,
    bonusClaimed,
    complete: savedResume && tailoredToCompany && trackedApplication,
  };
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401, headers: NO_STORE });
  return NextResponse.json(await buildStatus(user.id), { headers: NO_STORE });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401, headers: NO_STORE });
  const status = await buildStatus(user.id);
  if (!status.complete) return NextResponse.json({ error: "checklist_incomplete" }, { status: 409, headers: NO_STORE });
  if (status.bonusClaimed) return NextResponse.json({ ok: true, alreadyClaimed: true }, { headers: NO_STORE });
  const granted = await grantCredits(user.id, 1, "onboarding_checklist", { source: "dashboard_checklist" });
  return NextResponse.json({ ok: Boolean(granted), alreadyClaimed: !granted }, { headers: NO_STORE });
}
