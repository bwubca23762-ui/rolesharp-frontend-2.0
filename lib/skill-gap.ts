/**
 * The skill gap.
 *
 * A checker tells you which of a role's skills your resume does not mention.
 * That is one bucket, and it hides the distinction that actually decides what
 * you should do next:
 *
 *   - the target role wants it, and your resume shows it            -> nothing to do
 *   - the target wants it, your resume is silent, but your CURRENT
 *     role lists it too                                             -> you probably
 *     have it and never wrote it down. That is an editing job tonight, not a
 *     course.
 *   - the target wants it and nothing in your history suggests it   -> the real gap
 *
 * Splitting the second case out is the whole point of this module. Most of what
 * reads as "unqualified" is undocumented, and telling someone to go and learn
 * something they already do every day is the fastest way to lose them.
 *
 * Matching reuses termPresent() from the checker rather than reimplementing it,
 * plus the singular/plural fold the recruiter read already uses for exactly
 * this reason: the score treats "dashboards" and "dashboard" as different
 * tokens, which is right for keyword coverage and wrong when the question is
 * "have you done this?". Both borrowed, neither rewritten.
 *
 * The fold stops at plurals on purpose. It does NOT relate "reconciled" to
 * "Reconciliation", and a wider stemmer is not obviously safe — "Excel" is a
 * prefix of "excellent", so a prefix rule would credit a skill nobody claimed.
 * That is why every unfound skill is ASKED ABOUT rather than asserted, the rule
 * lib/recruiter-feedback.ts set: nothing here claims the reader lacks anything,
 * because a document cannot support that claim, and because the match is still
 * only matching words.
 */

import { termPresent } from "./resume-checker";
import { stem } from "./ats-score";
import { skillsOf, type MapRole } from "./career-map";

export type GapStatus = "evidenced" | "undocumented" | "unproven";

export type SkillVerdict = {
  skill: string;
  status: GapStatus;
  note: string;
  /** Editable bullet template with [X%]/[N] slots — the candidate fills real numbers. */
  resumeBulletSuggestion?: string;
  /** A concrete weekend proof-of-work project that makes the skill demonstrable. */
  proofProjectIdea?: string;
  /** Deep link into the verified free-certification catalogue. */
  freeCertUrl?: string;
};

export type SkillGap = {
  targetTitle: string;
  currentTitle: string | null;
  verdicts: SkillVerdict[];
  /** Share of the target's skills the resume evidences, 0..100. */
  coverage: number;
};

export function analyseSkillGap(resumeText: string, target: MapRole, current: MapRole | null): SkillGap {
  // Same cap as checkResume: a caller that forgets an API-level limit must not
  // push an unbounded string through the regex passes.
  const hay = resumeText.slice(0, 40000).toLowerCase();
  const currentSkills = new Set(
    current ? skillsOf(current).map((s) => s.toLowerCase()) : [],
  );
  // Single words only: folding a phrase like "financial reporting" word by word
  // would let "revenue reporting" satisfy it, which is a different skill.
  const stemmed = new Set((hay.match(/[a-z][a-z0-9+#.]{2,}/g) ?? []).map(stem));
  const evidences = (skill: string) =>
    termPresent(hay, skill) || (!/\s/.test(skill) && stemmed.has(stem(skill.toLowerCase())));

  const certUrl = (skill: string) =>
    `/free-certifications?topic=${encodeURIComponent(skill.toLowerCase())}`;

  const proofIdea = (skill: string) =>
    `Build a small public proof-of-work in a weekend: a repo or one-page write-up where you use ${skill} on a real dataset or task, then link it from /u/[your-handle].`;

  const verdicts = skillsOf(target).map((skill): SkillVerdict => {
    if (evidences(skill)) {
      return { skill, status: "evidenced", note: "Your resume already says this." };
    }
    if (currentSkills.has(skill.toLowerCase())) {
      return {
        skill,
        status: "undocumented",
        note: current
          ? `${current.title} lists this too, and your resume does not mention it. If you have done it, it belongs on the page.`
          : "Your resume does not mention this.",
        // It IS in their current role: the bullet just needs surfacing with a
        // number only they can supply.
        resumeBulletSuggestion: `Used ${skill} to [do what, for whom], improving [X%] or saving [N hrs/wk]`,
        freeCertUrl: certUrl(skill),
      };
    }
    return {
      skill,
      status: "unproven",
      // A question, not a verdict. The document cannot tell us whether they
      // have done this, so it must not say they have not.
      note: "The target role lists this and I cannot find it in your resume — have you done it?",
      proofProjectIdea: proofIdea(skill),
      resumeBulletSuggestion: `Completed a ${skill} project: [what you built], resulting in [measurable outcome]`,
      freeCertUrl: certUrl(skill),
    };
  });

  const evidenced = verdicts.filter((v) => v.status === "evidenced").length;
  return {
    targetTitle: target.title,
    currentTitle: current?.title ?? null,
    verdicts,
    coverage: verdicts.length ? Math.round((evidenced / verdicts.length) * 100) : 0,
  };
}

export function byStatus(gap: SkillGap, status: GapStatus): SkillVerdict[] {
  return gap.verdicts.filter((v) => v.status === status);
}

/** What to do next, in the order it is worth doing. Written from the counts, so
 * it cannot promise a step the analysis did not find work for. */
export function nextSteps(gap: SkillGap): string[] {
  const undocumented = byStatus(gap, "undocumented").length;
  const unproven = byStatus(gap, "unproven").length;
  const steps: string[] = [];

  if (undocumented > 0) {
    steps.push(
      `Start with the ${undocumented} skill${undocumented === 1 ? "" : "s"} your current role lists and your resume does not. Each one needs a bullet with what you did and what changed — not a line in a skills list.`,
    );
  }
  if (unproven > 0) {
    steps.push(
      `The remaining ${unproven} are the ones to be honest about. Anything you have genuinely done belongs on the page; anything you have not is a plan, not a rewrite.`,
    );
  }
  if (undocumented === 0 && unproven === 0) {
    steps.push("Your resume already evidences every skill this role lists. The gap is not on the page — it is in getting the page read.");
  }
  steps.push("Re-score the resume against the target role once you have edited it, so you can see the change rather than assume it.");
  return steps;
}

export const GAP_LIMITS = [
  "This compares your resume against the skills the occupational data lists for a role. It is not an assessment of you, and no employer uses it.",
  "A skill counted as missing may be one you have under a different name. The match is whole-word and alias-aware, but it is still matching words.",
  "Nothing here is stored. The resume text is analysed in the request and not written anywhere.",
];
