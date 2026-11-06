import { chat } from "../llm";
import { ResumeContent, type ResumeContent as ResumeContentType } from "../types";

// Phase 4: drafter–reviewer separation for premium generations. The drafter
// wrote; a second model pass reads the draft with fresh eyes, critiques it
// against the job description, and the drafter revises. Two hard rules keep
// this honest:
//
// 1. Fail open, always. Any parse error, timeout, or provider failure returns
//    the original draft — a premium user must never receive a WORSE resume
//    because the reviewer hiccuped, and the generation must never fail here
//    (a credit was already spent).
// 2. Revision is a rewrite, not an invention. The reviewer may flag; the
//    reviser may reframe, reorder, and strengthen wording. Neither may add an
//    employer, date, skill, or metric the draft does not already contain.
//    The revised JSON is schema-validated and discarded otherwise.

const REVIEW_TIMEOUT_MS = 60_000;

const REVIEWER_SYS =
  "You are a senior technical recruiter reviewing a draft resume against a job description. " +
  "Identify only concrete, fixable problems: keywords from the posting the draft genuinely supports but misses, " +
  "vague bullet framing, generic phrasing, ordering that buries the most relevant experience. " +
  "You must never suggest adding skills, employers, dates, or metrics the draft does not already contain, " +
  "and never suggest inventing experience. Return ONLY JSON: " +
  '{"issues": ["..."], "verdict": "ship" | "revise"}. ' +
  'Use verdict "ship" when the draft needs no changes. Maximum 6 issues, most important first.';

const REVISER_SYS =
  "You revise a resume JSON to address reviewer issues. Rules: keep the exact JSON schema; " +
  "never add employers, dates, skills, certifications, or metrics that are not already present; " +
  "never remove factual content; you may rewrite bullet wording, reorder bullets and sections, and " +
  "strengthen verbs. Return ONLY the revised resume JSON.";

export type ReviewerVerdict = { issues: string[]; verdict: "ship" | "revise" };

/** Pure parse of the reviewer's reply — exported for tests, tolerant by design. */
export function parseReviewerVerdict(raw: string): ReviewerVerdict {
  try {
    const parsed = JSON.parse(raw) as { issues?: unknown; verdict?: unknown };
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((issue): issue is string => typeof issue === "string" && issue.trim().length > 0).slice(0, 6)
      : [];
    return { issues, verdict: parsed.verdict === "revise" && issues.length > 0 ? "revise" : "ship" };
  } catch {
    return { issues: [], verdict: "ship" };
  }
}

export function buildReviewerMessages(input: {
  draft: ResumeContentType;
  jdText?: string;
  roleTitle?: string;
  companyName?: string;
}): { role: string; content: string }[] {
  const target = [input.roleTitle, input.companyName].filter(Boolean).join(" at ") || "the target role";
  const jd = input.jdText?.slice(0, 4_000) || "(no job description provided — critique against the target role only)";
  return [
    { role: "system", content: REVIEWER_SYS },
    {
      role: "user",
      content: `Target: ${target}\n\nJob description:\n${jd}\n\nDraft resume JSON:\n${JSON.stringify(input.draft)}\n\nReview now.`,
    },
  ];
}

export function buildReviserMessages(input: {
  draft: ResumeContentType;
  issues: readonly string[];
  jdText?: string;
  roleTitle?: string;
  companyName?: string;
}): { role: string; content: string }[] {
  const target = [input.roleTitle, input.companyName].filter(Boolean).join(" at ") || "the target role";
  return [
    { role: "system", content: REVISER_SYS },
    {
      role: "user",
      content: `Target: ${target}\n\nReviewer issues to address:\n${input.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}\n\nDraft resume JSON:\n${JSON.stringify(input.draft)}\n\nReturn the revised resume JSON.`,
    },
  ];
}

/**
 * Review + revise a premium draft. Exported for the worker; every failure
 * path returns the original draft.
 */
export async function reviewAndRevise(
  draft: ResumeContentType,
  input: { jdText?: string; roleTitle?: string; companyName?: string; model: "claude" | "gemini" },
): Promise<ResumeContentType> {
  const signal = AbortSignal.timeout(REVIEW_TIMEOUT_MS);
  const reviewRaw = await chat(buildReviewerMessages({ draft, ...input }), {
    json: true, temperature: 0.3, model: input.model, signal,
  });
  const verdict = parseReviewerVerdict(String(reviewRaw ?? ""));
  if (verdict.verdict === "ship" || !verdict.issues.length) return draft;

  const revisedRaw = await chat(buildReviserMessages({ draft, issues: verdict.issues, ...input }), {
    json: true, temperature: 0.4, model: input.model, signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
  });
  const candidate: unknown = JSON.parse(String(revisedRaw ?? "null"));
  const safe = ResumeContent.safeParse(candidate);
  return safe.success ? safe.data : draft;
}
