import { terms } from "./ats-score";
import type { ResumeContent } from "./types";

// Phase 6: STAR-mapped interview prep. The premium interview pack asks
// evidence-grounded questions; this module maps each question to the
// candidate's OWN bullets — the situation and action lines of a STAR answer
// come verbatim from the resume they actually submitted, and the result line
// is the honest part: quantified when the bullet carries a real metric, a
// prepare-or-bridge prompt when it does not. A question with no evidential
// overlap in the resume gets no mapping at all — an unanchored STAR story
// would be an invitation to fabricate, and this module declines the
// invitation.

export type StarEntry = {
  question: string;
  experienceTitle: string;
  company: string;
  bullet: string;
  hasMetric: boolean;
  situation: string;
  action: string;
  resultPrompt: string;
};

type BulletAnchor = {
  experienceTitle: string;
  company: string;
  bullet: string;
  hasMetric: boolean;
  keywords: ReadonlySet<string>;
};

function bulletAnchors(content: ResumeContent): BulletAnchor[] {
  const out: BulletAnchor[] = [];
  for (const experience of content.experiences) {
    for (const bullet of experience.bullets) {
      const trimmed = bullet.trim();
      if (trimmed.length < 8) continue;
      out.push({
        experienceTitle: experience.title,
        company: experience.company,
        bullet: trimmed,
        hasMetric: /\d/u.test(trimmed),
        keywords: new Set(terms(trimmed)),
      });
    }
  }
  return out;
}

function overlapScore(question: string, anchor: BulletAnchor): number {
  const questionTerms = terms(question);
  let score = 0;
  for (const term of questionTerms) if (anchor.keywords.has(term)) score += 1;
  return score;
}

export function buildStarGuidance(
  content: ResumeContent,
  questions: readonly string[],
): { entries: StarEntry[] } {
  const anchors = bulletAnchors(content);
  const entries: StarEntry[] = [];
  const used = new Set<BulletAnchor>();
  for (const question of questions) {
    let best: BulletAnchor | null = null;
    let bestScore = 0;
    for (const anchor of anchors) {
      if (used.has(anchor)) continue;
      const score = overlapScore(question, anchor);
      if (score > bestScore) { best = anchor; bestScore = score; }
    }
    if (!best || bestScore === 0) continue; // no evidence — no mapping
    used.add(best);
    entries.push({
      question,
      experienceTitle: best.experienceTitle,
      company: best.company,
      bullet: best.bullet,
      hasMetric: best.hasMetric,
      situation: `As ${best.experienceTitle} at ${best.company},`,
      action: best.bullet,
      resultPrompt: best.hasMetric
        ? `Your bullet already cites a number ("${best.bullet}"). Rehearse the full outcome: what changed, over what period, and how it was measured.`
        : "This bullet has no measurable result. Prepare one you can defend — or an honest bridge answer about what you observed — without inventing a number.",
    });
    if (entries.length >= 6) break;
  }
  return { entries };
}
