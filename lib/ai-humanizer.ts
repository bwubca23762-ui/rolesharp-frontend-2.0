// Five-pass deterministic de-AI engine ("AI-Touch Remover"). Pure TypeScript,
// no dependencies, isomorphic: the /ai-humanizer studio runs it directly in the
// browser, /build's generation pipeline runs it server-side on LLM output, and
// the Bot-Stealth badge computes its score from the same functions.
//
// The contract, mirroring the Zero-Fabrication rule that governs generation:
// this pass may only REMOVE machine fingerprints (hidden watermarks, RLHF
// cliché verbs, robotic participial tails) and swap repeated opening verbs
// for plainer equivalents — it never invents metrics, never touches numbers,
// and never alters technical keywords. Every change is counted and shown.

import type { ResumeContent } from "./types";

// ── Pass 1: invisible watermarks ─────────────────────────────────────────────
// Zero-width spaces, directional marks, BOM, word joiners, and non-breaking
// spaces that copy-paste from ChatGPT/Claude leaves behind. Also collapses
// excessive em-dashes: one em-dash is legitimate human punctuation; two or
// more on a line is the LLM signature.

export const WATERMARK_RE = /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060]/g;
const NBSP_RE = /\u00A0/g;

export type HumanizeCounts = {
  watermarks: number;
  cliches: number;
  tails: number;
  rotatedOpenings: number;
};

export type HumanizeDiffEntry = {
  before: string;
  after: string;
  notes: string[];
};

export type HumanizeResult = {
  text: string;
  counts: HumanizeCounts;
  diff: HumanizeDiffEntry[];
};

// ── Pass 2: AI cliché & buzzword rewriter (45+ entries) ─────────────────────
// High-frequency RLHF giveaway verbs and adjectives rewritten as direct
// practitioner language. Word boundaries protect technical terms: "ledgers"
// never matches "led", "utilization metrics" is untouched because the map
// keys on the verb "utilized". Numbers and keywords are never edited.

const CLICHE_REWRITES: Array<[RegExp, string]> = [
  [/\bspearheaded\b/gi, "led"],
  [/\borchestrated\b/gi, "coordinated"],
  [/\bchampioned\b/gi, "led"],
  [/\bpioneered\b/gi, "created"],
  [/\bleveraged\b/gi, "used"],
  [/\butilized\b/gi, "used"],
  [/\butilised\b/gi, "used"],
  [/\bharnessed\b/gi, "used"],
  [/\bdelved\s+deep\s+into\b/gi, "examined"],
  [/\bdelved\s+into\b/gi, "examined"],
  [/\bdove\s+deep\s+into\b/gi, "examined"],
  [/\bconducted\s+a\s+deep\s+dive\s+into\b/gi, "reviewed"],
  [/\bdeep\s+dive\b/gi, "detailed review"],
  [/\bdeep-dive\b/gi, "detailed review"],
  [/\bnavigated\s+the\s+complexities\s+of\b/gi, "worked through"],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bcutting\s+edge\b/gi, "modern"],
  [/\bstate-of-the-art\b/gi, "modern"],
  [/\bnext-generation\b/gi, "modern"],
  [/\bbest-in-class\b/gi, "strong"],
  [/\bworld-class\b/gi, "strong"],
  [/\btop-tier\b/gi, "strong"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  [/\bmeticulously\b/gi, "carefully"],
  [/\bmeticulous\b/gi, "careful"],
  [/\bholistically\b/gi, "completely"],
  [/\bholistic\b/gi, "complete"],
  [/\bpivotal\b/gi, "key"],
  [/\bparamount\b/gi, "critical"],
  [/\bcrucial\b/gi, "key"],
  [/\ba\s+testament\s+to\b/gi, "proof of"],
  [/\btestament\s+to\b/gi, "proof of"],
  [/\bdynamic\s+and\s+results-driven\b/gi, "hands-on"],
  [/\bdynamic,\s+results-driven\b/gi, "hands-on"],
  [/\bresults-driven\b/gi, "outcome-focused"],
  [/\bresults-oriented\b/gi, "outcome-focused"],
  [/\bdynamic\s+professional\b/gi, "hands-on professional"],
  [/\bpassionate\s+about\b/gi, "focused on"],
  [/\bplethora\s+of\b/gi, "many"],
  [/\bmyriad\s+of\b/gi, "many"],
  [/\bmultifaceted\b/gi, "varied"],
  [/\blow-hanging\s+fruit\b/gi, "quick wins"],
  [/\bproven\s+track\s+record\b/gi, "track record"],
  [/\bin\s+order\s+to\b/gi, "to"],
  [/\bcommenced\b/gi, "started"],
  [/\bfacilitated\b/gi, "ran"],
  [/\brevolutionized\b/gi, "modernized"],
  [/\btransformative\b/gi, "major"],
  [/\bsynergized\b/gi, "combined"],
  [/\bsynergies\b/gi, "shared wins"],
  [/\bunlocked\s+the\s+potential\s+of\b/gi, "improved"],
  [/\bever-evolving\b/gi, "changing"],
  [/\bsuccessfully\s+/gi, ""],
  [/\beffectively\s+/gi, ""],
];

function applyClicheRewrites(line: string): { line: string; count: number } {
  let out = line;
  let count = 0;
  const startedUppercase = out.trimStart() !== out.trimStart().toLowerCase();
  for (const [pattern, replacement] of CLICHE_REWRITES) {
    out = out.replace(pattern, (matched) => {
      count += 1;
      // Preserve the sentence-initial capital the writer had.
      if (matched[0] >= "A" && matched[0] <= "Z") {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  if (startedUppercase && out.trimStart()) {
    out = out.replace(/^(\s*)(\w)/, (_m, ws: string, ch: string) => ws + ch.toUpperCase());
  }
  return { line: out, count };
}

export function countCliches(text: string): number {
  let count = 0;
  for (const [pattern] of CLICHE_REWRITES) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

// ── Pass 3: robotic participial tail trimmer ────────────────────────────────
// Trailing ", ensuring seamless…" / ", fostering a culture of…" / ", ultimately
// driving…" clauses. A tail that carries no number is fluff — it is removed.
// A tail that carries a number states a real fact, so it is kept, reconnected
// with the natural "while" a human writer would use.

const TAIL_VERBS = [
  "ensuring", "fostering", "empowering", "enabling", "driving", "positioning",
  "paving", "showcasing", "highlighting", "underscoring", "leveraging",
  "streamlining", "mitigating", "navigating", "demonstrating",
];

const TAIL_RE = new RegExp(
  `\\s*,\\s+(?:ultimately\\s+|thereby\\s+|thus\\s+)?(?:${TAIL_VERBS.join("|")})\\b[\\s\\S]*$`,
  "i",
);

export function countTails(text: string): number {
  return text.split(/\r?\n/).filter((line) => TAIL_RE.test(line)).length;
}

function trimTail(line: string): { line: string; removed: boolean } {
  const match = line.match(TAIL_RE);
  if (!match) return { line, removed: false };
  const tail = match[0];
  const head = line.slice(0, match.index);
  if (/\d/.test(tail)) {
    // The tail states a quantified fact — keep it, reconnect naturally.
    const cleanTail = tail.replace(/^\s*,\s+(?:ultimately\s+|thereby\s+|thus\s+)?/i, " while ");
    return { line: head + cleanTail, removed: false };
  }
  let out = head.trimEnd();
  out = out.replace(/[,;:]$/, "");
  if (out && !/[.!?)]$/.test(out)) out += ".";
  return { line: out, removed: true };
}

// ── Pass 4: burstiness & cadence diversifier ────────────────────────────────
// Humans vary their bullet openings; LLM output repeats "Led … Led … Led …".
// When adjacent bullets in one run open with the same verb, later occurrences
// rotate through plain alternates. Sentence lengths are reported (Burstiness
// Index = word-count standard deviation) but never fabricated: the pass
// rotates verbs, it does not pad or cut content to fake variation.

const OPENING_ALTERNATES: Record<string, string[]> = {
  led: ["guided", "directed"],
  guided: ["directed", "led"],
  directed: ["guided", "led"],
  built: ["created", "developed"],
  created: ["built", "developed"],
  developed: ["built", "created"],
  shipped: ["delivered", "released"],
  delivered: ["shipped", "released"],
  released: ["shipped", "delivered"],
  reduced: ["trimmed", "lowered"],
  trimmed: ["reduced", "lowered"],
  cut: ["reduced", "lowered"],
  lowered: ["reduced", "trimmed"],
  improved: ["raised", "strengthened"],
  grew: ["expanded"],
  launched: ["introduced"],
  owned: ["ran"],
  ran: ["owned"],
  drove: ["pushed"],
  automated: ["scripted"],
  managed: ["oversaw"],
  designed: ["planned"],
};

const BULLET_PREFIX_RE = /^\s*(?:[-•*·]|\d+[.)])\s+/;

function openingWord(line: string): string {
  const stripped = line.replace(BULLET_PREFIX_RE, "").trim().toLowerCase();
  const first = stripped.split(/\s+/)[0] ?? "";
  return first.replace(/[^a-z]/g, "");
}

export function rotateOpenings(lines: string[]): { lines: string[]; rotated: number } {
  const out = [...lines];
  let rotated = 0;
  let prevWord = "";
  const usedInRun = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    const word = openingWord(out[i]);
    if (!word || !OPENING_ALTERNATES[word]) {
      prevWord = "";
      usedInRun.clear();
      continue;
    }
    if (word === prevWord) {
      const alternates = OPENING_ALTERNATES[word].filter((alt) => !usedInRun.has(alt));
      if (alternates.length) {
        const alt = alternates[0];
        usedInRun.add(alt);
        // Swap only the opening verb — the first word after any bullet prefix.
        out[i] = out[i].replace(
          new RegExp(`^(\\s*(?:[-•*·]|\\d+[.)])?\\s*)(${word})\\b`, "i"),
          (_full: string, prefix: string, verb: string) => {
            const startsUpper = verb[0] >= "A" && verb[0] <= "Z";
            return prefix + (startsUpper ? alt.charAt(0).toUpperCase() + alt.slice(1) : alt);
          },
        );
        rotated += 1;
      }
    } else {
      usedInRun.clear();
      usedInRun.add(word);
    }
    prevWord = word;
  }
  return { lines: out, rotated };
}

function countRepeatedOpenings(lines: string[]): number {
  let count = 0;
  let prev = "";
  for (const line of lines) {
    const word = openingWord(line);
    if (word && word === prev && OPENING_ALTERNATES[word]) count += 1;
    prev = word;
  }
  return count;
}

// ── Pass 1 helpers ──────────────────────────────────────────────────────────

function scrubLine(line: string): { line: string; watermarks: number; emDashClusters: number } {
  let watermarks = 0;
  let out = line.replace(WATERMARK_RE, () => {
    watermarks += 1;
    return "";
  });
  out = out.replace(NBSP_RE, () => {
    watermarks += 1;
    return " ";
  });
  let emDashClusters = 0;
  const emDashes = (out.match(/—/g) ?? []).length;
  if (emDashes >= 2) {
    emDashClusters = 1;
    out = out
      .replace(/\s*—\s*/g, ", ")
      .replace(/(,\s*)+,/g, ", ")
      .replace(/,\s*$/, "")
      .trim();
    if (out && !/[.!?)]$/.test(out)) out += ".";
  }
  return { line: out, watermarks, emDashClusters };
}

// ── The five-pass pipeline ──────────────────────────────────────────────────

export function humanizeResumeText(text: string): HumanizeResult {
  const counts: HumanizeCounts = { watermarks: 0, cliches: 0, tails: 0, rotatedOpenings: 0 };
  const rawLines = text.split(/\r?\n/);
  const diff: HumanizeDiffEntry[] = [];
  const processed: string[] = [];

  // Passes 1–3 are per-line; pass 4 rotates adjacent bullet runs afterwards.
  for (const raw of rawLines) {
    const pass1 = scrubLine(raw);
    counts.watermarks += pass1.watermarks;
    const pass2 = applyClicheRewrites(pass1.line);
    counts.cliches += pass2.count;
    const pass3 = trimTail(pass2.line);
    if (pass3.removed) counts.tails += 1;
    processed.push(pass3.line);
    const notes: string[] = [];
    if (pass1.watermarks > 0) notes.push(`Removed ${pass1.watermarks} invisible watermark character${pass1.watermarks === 1 ? "" : "s"}.`);
    if (pass2.count > 0) notes.push(`Rewrote ${pass2.count} AI cliché${pass2.count === 1 ? "" : "s"} into plain practitioner language.`);
    if (pass3.removed) notes.push("Removed a robotic \u2011ing tail clause that carried no fact.");
    if (raw !== pass3.line) diff.push({ before: raw, after: pass3.line, notes });
  }

  // Pass 4: rotate repeated consecutive bullet openings within each run of
  // bullet-marked lines (raw-text mode). Plain prose lines are left alone —
  // consecutive prose sharing a first word is usually intentional.
  const finalLines: string[] = [];
  let run: string[] = [];
  const flushRun = () => {
    if (run.length >= 2) {
      const rotated = rotateOpenings(run);
      counts.rotatedOpenings += rotated.rotated;
      for (let i = 0; i < run.length; i++) {
        if (run[i] !== rotated.lines[i]) {
          diff.push({ before: run[i], after: rotated.lines[i], notes: ["Rotated a repeated bullet opening verb for natural cadence."] });
        }
      }
      finalLines.push(...rotated.lines);
    } else {
      finalLines.push(...run);
    }
    run = [];
  };
  for (const line of processed) {
    if (BULLET_PREFIX_RE.test(line)) {
      run.push(line);
    } else {
      flushRun();
      finalLines.push(line);
    }
  }
  flushRun();

  return { text: finalLines.join("\n"), counts, diff };
}

// ── Pass 5: authenticity telemetry ──────────────────────────────────────────

export type HumanAuthenticity = {
  humanScore: number;
  aiRisk: number;
  burstiness: number;
  watermarks: number;
  cliches: number;
  tails: number;
  repeatedOpenings: number;
  emDashClusters: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function burstinessIndex(text: string): number {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return 0;
  const counts = lines.map((l) => (l.match(/[A-Za-z0-9][A-Za-z0-9+#.%$'-]*/g) ?? []).length);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (mean <= 0) return 0;
  const variance = counts.reduce((acc, c) => acc + (c - mean) ** 2, 0) / counts.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function scoreHumanAuthenticity(text: string): HumanAuthenticity {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const watermarks = (text.match(WATERMARK_RE) ?? []).length + (text.match(NBSP_RE) ?? []).length;
  const cliches = countCliches(text);
  const tails = countTails(text);
  const repeatedOpenings = countRepeatedOpenings(lines.filter((l) => BULLET_PREFIX_RE.test(l)));
  const emDashClusters = lines.filter((l) => (l.match(/—/g) ?? []).length >= 2).length;
  const burstiness = burstinessIndex(text);

  const penalty =
    Math.min(60, cliches * 11) +
    Math.min(27, tails * 9) +
    Math.min(45, watermarks * 22) +
    (lines.length >= 3 && burstiness < 4.5 ? 12 : 0) +
    Math.min(12, repeatedOpenings * 4) +
    Math.min(8, emDashClusters * 4);

  const risk =
    Math.min(40, cliches * 13) +
    Math.min(30, tails * 10) +
    Math.min(60, watermarks * 30) +
    (lines.length >= 3 && burstiness < 4.5 ? 15 : 0) +
    Math.min(15, repeatedOpenings * 5) +
    Math.min(10, emDashClusters * 5);

  return {
    humanScore: clampScore(100 - penalty),
    aiRisk: clampScore(risk),
    burstiness,
    watermarks,
    cliches,
    tails,
    repeatedOpenings,
    emDashClusters,
  };
}

// ── Content-mode wrapper ─────────────────────────────────────────────────────
// The single server-side choke point for generated resumes: /build's pipeline
// runs every generated text field (summary, bullets, achievements, project
// details) through the same deterministic pass, so the builder never ships
// output its own detector would flag. Contact facts, titles, and keywords are
// structurally untouched — only prose fields are mapped.

export function humanizeResumeContent(content: ResumeContent): { content: ResumeContent; counts: HumanizeCounts } {
  const counts: HumanizeCounts = { watermarks: 0, cliches: 0, tails: 0, rotatedOpenings: 0 };
  const merge = (result: HumanizeResult) => {
    counts.watermarks += result.counts.watermarks;
    counts.cliches += result.counts.cliches;
    counts.tails += result.counts.tails;
    counts.rotatedOpenings += result.counts.rotatedOpenings;
  };

  const summary = humanizeResumeText(content.summary);
  merge(summary);

  const cleanBullet = (bullet: string) => {
    const cleaned = humanizeResumeText(bullet);
    merge(cleaned);
    return cleaned.text;
  };

  const experiences = content.experiences.map((exp) => {
    const bullets = rotateOpenings(exp.bullets.map(cleanBullet));
    counts.rotatedOpenings += bullets.rotated;
    return { ...exp, bullets: bullets.lines };
  });

  const achievementsRaw = rotateOpenings((content.achievements ?? []).map(cleanBullet));
  counts.rotatedOpenings += achievementsRaw.rotated;

  const projects = (content.projects ?? []).map((p) => ({ ...p, detail: humanizeResumeText(p.detail).text }));

  return {
    content: {
      ...content,
      summary: summary.text,
      experiences,
      achievements: achievementsRaw.lines,
      projects,
    },
    counts,
  };
}
