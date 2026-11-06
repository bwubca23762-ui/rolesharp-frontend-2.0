import { ResumeContent } from "./types";
import { METRIC_RE } from "./ats-score";

// Phase 5: follow-up drafts for quiet applications. The rules are absolute:
//
// 1. Drafts only. Nothing here sends mail — the tracker shows a draft, the
//    candidate copies it into their own mailbox. The compliance outbox is
//    untouched.
// 2. Claims only. Every sentence comes from data the candidate already
//    submitted: the role, the company, the application date, the posting URL,
//    and one bullet from the resume they actually applied with. No new
//    achievements, no invented enthusiasm, no fabricated timeline.
// 3. Capped. At most two follow-ups per application, at least seven days
//    apart — enforced in SQL (follow_up_count, migration 063), not in memory.
//    A quiet application gets at most two nudges, then it is left alone.

export const FOLLOWUP_QUIET_DAYS = 10;
export const FOLLOWUP_MAX_PER_APPLICATION = 2;
export const FOLLOWUP_MIN_SPACING_DAYS = 7;

export type FollowupCandidate = {
  applicationId: string;
  company: string;
  role: string;
  appliedAt: string;
  followUpCount: number;
  jobUrl: string | null;
  resumeId: string | null;
  candidateName: string | null;
  subject: string;
  body: string;
  citedBullet: string | null;
};

export type FollowupDraft = { subject: string; body: string; citedBullet: string | null };

/** Deterministic bullet pick: a metric-bearing bullet outranks the rest; ties keep resume order. */
export function pickCitedBullet(bullets: readonly string[], seed: number): string | null {
  const usable = bullets.map((b) => b.trim()).filter((b) => b.length > 0);
  if (!usable.length) return null;
  const withMetrics = usable.filter((b) => METRIC_RE.test(b));
  const pool = withMetrics.length ? withMetrics : usable;
  return pool[seed % pool.length];
}

export function buildFollowupDraft(input: {
  company: string;
  role: string;
  appliedAt: string;
  followUpCount: number;
  jobUrl?: string | null;
  candidateName?: string | null;
  bullets?: readonly string[];
  resumeId?: string | null;
  seed?: number;
}): FollowupDraft {
  const seed = input.seed ?? input.appliedAt.length;
  const cited = pickCitedBullet(input.bullets ?? [], seed);
  const ordinal = input.followUpCount === 0 ? "" : ` (following up again, briefly)`;
  const subject = `Following up — ${input.role} application${ordinal}`;
  const lines: string[] = [];
  lines.push(`Hello ${input.company} team,`);
  lines.push("");
  lines.push(
    `I applied for the ${input.role} position on ${new Date(input.appliedAt).toISOString().slice(0, 10)}${ordinal}. ` +
    `I remain interested in the role and wanted to check where things stand.`,
  );
  if (cited) {
    lines.push("");
    lines.push(`One line from my application worth a second look: ${cited}`);
  }
  if (input.jobUrl && /^https?:\/\//u.test(input.jobUrl)) {
    lines.push("");
    lines.push(`Original posting: ${input.jobUrl}`);
  }
  lines.push("");
  lines.push("Thank you for your time,");
  lines.push(input.candidateName ?? "");
  return { subject, body: lines.join("\n").trimEnd(), citedBullet: cited };
}

type ResumeRowLike = { candidate_name?: string | null; candidateName?: string | null; content?: unknown };

export function draftForApplication(application: {
  id: string; company: string; role: string; updated_at: string; job_url: string | null;
  follow_up_count: number; resume_id: string | null;
}, resume: ResumeRowLike | null | undefined): FollowupCandidate {
  let bullets: string[] = [];
  let candidateName: string | null = null;
  if (resume?.content) {
    const parsed = ResumeContent.safeParse(resume.content);
    if (parsed.success) {
      bullets = parsed.data.experiences.flatMap((e) => e.bullets);
      candidateName = resume.candidate_name ?? resume.candidateName ?? null;
    }
  }
  const draft = buildFollowupDraft({
    company: application.company,
    role: application.role,
    appliedAt: application.updated_at,
    followUpCount: application.follow_up_count,
    jobUrl: application.job_url,
    candidateName,
    bullets,
    resumeId: application.resume_id,
    seed: application.id.length,
  });
  return {
    applicationId: application.id,
    company: application.company,
    role: application.role,
    appliedAt: application.updated_at,
    followUpCount: application.follow_up_count,
    jobUrl: application.job_url,
    resumeId: application.resume_id,
    candidateName,
    ...draft,
  };
}
