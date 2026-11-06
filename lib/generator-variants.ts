import { extractJdTerms } from "./match-engine";

/**
 * Deterministic 3-angle variants for the micro-generators (2026-10-21).
 * Same Zero-Fabrication contract as the primary output: every variant is a
 * re-shaping of what the generator already produced — no new facts, no
 * invented metrics. Where an impact number would belong but none was
 * supplied, the impact variant uses an explicit [X%]/[$X] bracket slot.
 */

export type GeneratorVariant = {
  id: "impact" | "technical" | "concise";
  label: string;
  badge: string;
  text: string;
  wordCount: number;
  charCount: number;
};

function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const METRIC = /(\d+%|\$\d|\b\d+\+?\b)/;

function impactFirst(text: string): string {
  const sents = sentences(text);
  if (sents.length <= 1) {
    return sents.length === 1 && METRIC.test(sents[0]) ? sents[0] : `${sents[0] ?? ""} Delivered [X%] improvement, worth [$X] in annual impact.`.trim();
  }
  const withMetric = sents.find((s) => METRIC.test(s));
  if (!withMetric) {
    // Keep every fact, add an honest bracketed slot for the missing number.
    return `${sents[0]} Result: [X%] improvement / [$X] impact across [N] months.`;
  }
  return [withMetric, ...sents.filter((s) => s !== withMetric)].join(" ");
}

function technicalDepth(text: string, skills: string[]): string {
  const sents = sentences(text);
  const technical = sents.find((s) => skills.some((k) => s.toLowerCase().includes(k.toLowerCase())));
  const skillLine = skills.length ? ` Core stack: ${skills.slice(0, 6).join(", ")}.` : "";
  if (!technical) return `${sents.join(" ")}${skillLine}`;
  return [technical, ...sents.filter((s) => s !== technical)].join(" ") + skillLine;
}

function conciseSkim(text: string): string {
  const sents = sentences(text);
  let out = "";
  for (const s of sents) {
    if (wordCount(out) >= 35) break;
    out = out ? `${out} ${s}` : s;
  }
  return out || text;
}

/**
 * Derives three strategic angles from a generator's primary output.
 * Pure text shaping: the variants never introduce facts the output
 * didn't already carry.
 */
export function buildGeneratorVariants(output: string, skills: string[] = []): GeneratorVariant[] {
  const base = output.trim();
  if (!base) return [];
  const variants: Array<Omit<GeneratorVariant, "wordCount" | "charCount">> = [
    { id: "impact", label: "Impact & ROI-First", badge: "Leads with the number", text: impactFirst(base) },
    { id: "technical", label: "Technical & Domain Depth", badge: "For expert screeners", text: technicalDepth(base, skills) },
    { id: "concise", label: "Concise High-Skim", badge: "6-second read", text: conciseSkim(base) },
  ];
  return variants.map((v) => ({
    ...v,
    text: v.text.trim(),
    wordCount: wordCount(v.text),
    charCount: v.text.length,
  }));
}

/**
 * Keywords from the user's own evidence/skills that survived into the
 * output — shown as woven-keyword badges in the UI.
 */
export function wovenKeywordsFrom(output: string, sources: string[]): string[] {
  const pool = extractJdTerms(sources.join("\n"), 12);
  const lower = output.toLowerCase();
  return pool.filter((k) => lower.includes(k.toLowerCase())).slice(0, 8);
}
