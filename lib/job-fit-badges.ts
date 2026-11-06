import { q } from "./db";
import { matchResumeToJob } from "./match-engine";
import { resumeSourceText } from "./resume-source-text";
import { ResumeContent } from "./types";

// ── Batch fit badges for the jobs finder ──
// Scores one page of search results against the member's latest resume using
// the SAME deterministic engine as the public matcher tool and the ATS
// checker (lib/match-engine.ts → termPresent), and the same text flattening
// the renderers use (resumeSourceText). Fit badges can never disagree with
// the score a user sees after tailoring. Server-side only: resume text and
// job descriptions never leave the API boundary.

/** The member's newest resume flattened to plain text; null when they have none usable. */
export async function latestResumeText(userId: string): Promise<string | null> {
  const rows = await q<{ content: unknown }>(
    `select content from resumes
     where user_id_text=$1 or user_id=$1::uuid
     order by created_at desc limit 1`,
    [userId],
  );
  if (!rows[0]?.content) return null;
  const parsed = ResumeContent.safeParse(rows[0].content);
  if (!parsed.success) return null; // outdated shape — no badge beats a wrong badge
  const text = resumeSourceText(parsed.data);
  return text.length >= 40 ? text : null; // too thin to score meaningfully
}

export type JobFitBadge = {
  fitScore: number;
  grade: "Excellent" | "Strong" | "Fair" | "Weak";
  matched: number;
  missing: number;
  topMissing: string[];
};

/**
 * Scores a page of jobs against one resume. Runs entirely in-process (the
 * engine is deterministic, no LLM, no network) so 20 jobs ≈ a few ms.
 * Returns a map jobId → badge; jobs whose descriptions are empty get no
 * badge rather than a misleading zero.
 */
export function scoreJobPageForResume(
  resumeText: string,
  jobs: { id: string; title?: string; description?: string }[],
): Record<string, JobFitBadge> {
  const badges: Record<string, JobFitBadge> = {};
  for (const job of jobs) {
    const jdText = `${job.title ?? ""}\n${job.description ?? ""}`.trim();
    if (jdText.length < 40) continue;
    const result = matchResumeToJob(resumeText, jdText);
    if (result.counts.jdTerms < 3) continue; // JD too thin to grade honestly
    badges[job.id] = {
      fitScore: result.fitScore,
      grade: result.grade,
      matched: result.counts.matched,
      missing: result.counts.missing,
      topMissing: result.missing.slice(0, 3),
    };
  }
  return badges;
}
