import { terms } from "./ats-score";
import type { ResumeContent } from "./types";

// Interview battlecard (Phase 4): one page the candidate can actually hold
// in their head before an interview. Built ONLY from the resume's own
// evidence — every story, number, and claim traces back to a bullet. Gaps
// get honest bridge lines, never invented projects. Deterministic (no model
// call), so it is free-tier safe and reproducible.

export type BattlecardStory = {
  title: string;
  company: string;
  bullet: string;
  hasMetric: boolean;
  star: { situation: string; action: string; resultPrompt: string };
};

export type Battlecard = {
  stories: BattlecardStory[];
  evidenceTerms: string[];
  citableNumbers: { value: string; bullet: string }[];
  bridgeLines: { skill: string; line: string }[];
};

const MAX_STORIES = 3;
const MAX_TERMS = 12;
const MAX_NUMBERS = 8;
const MAX_BRIDGES = 5;

export function battlecardFor(content: ResumeContent): Battlecard {
  // Stories: metric bullets first (they survive panel probing), then the
  // longest non-metric bullets — a defensible narrative beats a short one.
  const bullets = content.experiences.flatMap((experience) =>
    experience.bullets
      .map((b) => b.trim())
      .filter((b) => b.length >= 8)
      .map((b) => ({ experience, bullet: b })),
  );
  const ranked = [
    ...bullets.filter(({ bullet }) => /\d/u.test(bullet)).sort((a, b) => b.bullet.length - a.bullet.length),
    ...bullets.filter(({ bullet }) => !/\d/u.test(bullet)).sort((a, b) => b.bullet.length - a.bullet.length),
  ];
  const seen = new Set<string>();
  const stories: BattlecardStory[] = [];
  for (const { experience, bullet } of ranked) {
    if (stories.length >= MAX_STORIES) break;
    if (seen.has(bullet)) continue;
    seen.add(bullet);
    const hasMetric = /\d/u.test(bullet);
    stories.push({
      title: experience.title,
      company: experience.company,
      bullet,
      hasMetric,
      star: {
        situation: `As ${experience.title} at ${experience.company},`,
        action: bullet,
        resultPrompt: hasMetric
          ? `Cite the number ("${numberIn(bullet)}") and what it changed for the team.`
          : "No number here — prepare an honest observed outcome, or a bridge, not an invented figure.",
      },
    });
  }

  // Evidence terms: the vocabulary the candidate can defensibly use, ranked
  // by how often the resume itself backs it.
  const frequency = new Map<string, number>();
  const count = (text: string) => {
    for (const term of terms(text)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  };
  for (const skill of content.skills) count(skill);
  for (const { bullet } of bullets) count(bullet);
  if (content.summary) count(content.summary);
  const evidenceTerms = [...frequency.entries()]
    .filter(([term]) => term.length >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TERMS)
    .map(([term]) => term);

  // Citable numbers: every number on the card exists verbatim in a bullet.
  const citableNumbers: Battlecard["citableNumbers"] = [];
  for (const { bullet } of bullets) {
    for (const match of bullet.matchAll(/\d[\d,.]*\s*(?:%|k|m|x|bn|million|billion)?/giu)) {
      if (citableNumbers.length >= MAX_NUMBERS) break;
      const value = match[0].trim();
      if (citableNumbers.some((n) => n.value === value)) continue;
      citableNumbers.push({ value, bullet });
    }
    if (citableNumbers.length >= MAX_NUMBERS) break;
  }

  // Bridge lines: skills the resume lists but no bullet evidences. The line
  // tells the candidate how to answer honestly — adjacent evidence, never a
  // fabricated project.
  const bulletText = bullets.map(({ bullet }) => bullet).join(" ").toLowerCase();
  const bridgeLines: Battlecard["bridgeLines"] = [];
  for (const skill of content.skills) {
    if (bridgeLines.length >= MAX_BRIDGES) break;
    const name = skill.trim();
    if (name.length < 2 || terms(name).some((term) => bulletText.includes(term))) continue;
    const adjacent = stories[0]?.title;
    bridgeLines.push({
      skill: name,
      line: adjacent
        ? `If asked about ${name}: say honestly where you have used it or name the closest thing you have done (${adjacent} work) — no invented project.`
        : `If asked about ${name}: say honestly how you have used it, or that it is developing — no invented project.`,
    });
  }

  return { stories, evidenceTerms, citableNumbers, bridgeLines };
}

function numberIn(bullet: string): string {
  return bullet.match(/\d[\d,.]*\s*(?:%|k|m|x)?/iu)?.[0]?.trim() ?? bullet.slice(0, 40);
}
