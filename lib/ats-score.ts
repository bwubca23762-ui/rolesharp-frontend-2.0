import { hasLinkedinLink } from "./contact-links";
import { checkResumeContent } from "./resume-checker";
import { type ResumeContent as RC } from "./types";

// Pure, dependency-free ATS scoring — safe to import on the client (the builder's
// live score meter) AND the server (lib/tailor.ts re-exports these). Extracted
// from tailor.ts so importing the scorer doesn't pull in the LLM/queue (node-only).

const STOP = new Set([
  "the", "and", "for", "with", "you", "our", "are", "will", "this", "that", "have", "from", "your",
  "role", "team", "work", "ability", "candidate", "ideal", "including", "across", "using", "within",
  "strong", "support", "required", "preferred", "experience", "years", "job", "description",
  // generic JD fluff — verbs/nouns that aren't real ATS keywords and shouldn't
  // be keyword-stuffed into a resume; counting them just deflates the score.
  "hiring", "develop", "developing", "test", "testing", "maintain", "maintaining",
  "build", "building", "write", "writing", "clean", "efficient", "collaborate",
  "collaborating", "functional", "improve", "improving", "participate", "rotations",
  "requirements", "responsibilities", "equivalent", "mentoring", "deploy", "deploying",
  "design", "designing", "responsible", "looking", "seeking", "join", "help", "etc",
  "plus", "must", "should", "who", "what", "where", "when", "they", "their", "them",
  "well", "also", "into", "more", "than", "such", "other", "based", "able", "good",
  "candidates",
]);

const NORMALIZED_PHRASES: Array<[RegExp, string]> = [
  [/\bamazon\s+web\s+services\b/gi, " aws "],
  [/\bgoogle\s+cloud\s+platform\b/gi, " gcp "],
  [/\bcontinuous\s+integration(?:\s+(?:and|&)\s+continuous\s+delivery)?\b/gi, " cicd "],
  [/\bnode\.?\s*js\b/gi, " nodejs "],
  [/\breact\.?\s*js\b/gi, " react "],
  [/\bnext\.?\s*js\b/gi, " nextjs "],
  [/\bvue\.?\s*js\b/gi, " vue "],
  [/\bci\s*\/\s*cd\b/gi, " cicd "],
  [/\ba\/b\s*testing\b/gi, " ab testing experimentation "],
  [/\brestful\b/gi, " rest api "],
  [/\bapis\b/gi, " api "],
  [/\bfront[\s-]?end\b/gi, " frontend "],
  [/\bback[\s-]?end\b/gi, " backend "],
  [/\bcross[\s-]?functional\b/gi, " crossfunctional stakeholder collaboration "],
  [/\bstakeholder management\b/gi, " stakeholder collaboration "],
  [/\bwcag\b/gi, " accessibility wcag "],
  [/\bkpis\b/gi, " kpi metric analytics "],
  [/\baws\b/gi, " aws "],
];

const CANONICAL_TERMS = new Map<string, string>([
  ["k8s", "kubernetes"],
  ["postgres", "postgresql"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["aws", "aws"],
  ["gcp", "gcp"],
  ["node", "nodejs"],
  ["nodejs", "nodejs"],
  ["reactjs", "react"],
  ["frontend", "frontend"],
  ["front", "frontend"],
  ["backend", "backend"],
  ["back", "backend"],
  ["apis", "api"],
  ["restful", "rest"],
]);

// Short tokens are useful only when they name a recognized technical skill.
// Keep this deliberately allow-listed so single-letter words in prose do not
// inflate keyword coverage.
const SHORT_TECHNICAL_TERMS = new Set([
  "c", "r", "go", "c#", "c++", "ai", "ml", "qa", "ui", "ux", "js", "ts",
]);

// A bullet "has impact" if it carries a number/metric. Shared by the score and
// the builder's inline "add a number" hint so they always agree.
// Note: digits already cover "3x"/"10x"; bare `x\b` matched "linux"/"UX" and
// unanchored under/over matched "moreover"/"discover" — false quantification.
export const METRIC_RE = /(\d|%|\$|\bunder\b|\bover\b|\bfrom .+? to )/i;
export function hasMetric(s: string): boolean {
  return METRIC_RE.test(s);
}

/**
 * Crude singular/plural fold, shared by everything that asks "does this text
 * already say this?" rather than "does this token appear?".
 *
 * The score treats "dashboards" and "dashboard" as different tokens, which is
 * right for keyword coverage and wrong everywhere a human reads the output:
 * telling somebody a posting wants dashboards when their bullet says "the
 * weekly revenue dashboard" reads as not having read it. The tokenisers here
 * keep a trailing full stop, so the strip has to happen before the fold or the
 * last word of a sentence never matches.
 *
 * Lives here rather than in recruiter-feedback.ts so micro-generators.ts can
 * use it without a cycle -- recruiter-feedback already imports micro-generators.
 */
export function stem(word: string): string {
  return word.toLowerCase().replace(/^[.]+|[.]+$/g, "").replace(/(?:ies|es|s)$/, "");
}

export function normalizeForMatch(text: string): string {
  let out = ` ${text.toLowerCase()} `;
  for (const [pattern, replacement] of NORMALIZED_PHRASES) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

function canonicalTerm(term: string): string {
  return CANONICAL_TERMS.get(term) ?? term;
}

export function terms(text: string) {
  return (
    normalizeForMatch(text)
      .match(/[a-z][a-z0-9+#.]*/g)
      ?.map((w) => w.replace(/^[.]+|[.]+$/g, "")) // strip leading/trailing dots ("systems." -> "systems")
      .map(canonicalTerm)
      .filter((w) => {
        const isExplicitSingleLetterLanguage = (w === "c" && /\bC\b/.test(text)) || (w === "r" && /\bR\b/.test(text));
        return (w.length >= 3 || (SHORT_TECHNICAL_TERMS.has(w) && (w !== "c" && w !== "r" || isExplicitSingleLetterLanguage)))
          && !STOP.has(w);
      }) ?? []
  );
}

function contentText(content: RC): string {
  return [
    content.headline,
    content.summary,
    content.skills?.join(" "),
    content.experiences?.flatMap((e) => [e.title, e.company, ...(e.bullets ?? [])]).join(" "),
    content.education?.flatMap((e) => [e.degree, e.school, e.detail, e.year]).join(" "),
    content.projects?.flatMap((p) => [p.name, p.detail]).join(" "),
    content.certifications?.join(" "),
    content.languages?.join(" "),
    content.achievements?.join(" "),
  ].filter(Boolean).join(" ");
}

export function keywordCoverage(jd: string, resumeText: string) {
  const jdTerms = [...new Set(terms(jd))].slice(0, 80);
  if (!jdTerms.length) return 0.65;
  const hay = new Set(terms(resumeText));
  const hits = jdTerms.filter((term) => hay.has(term)).length;
  return hits / jdTerms.length;
}

// JD terms not yet present in the resume — used for the live "X/Y keywords" hint.
function missingJdTerms(jd: string, resumeText: string, limit = 12): string[] {
  if (!jd.trim()) return [];
  const hay = new Set(terms(resumeText));
  return [...new Set(terms(jd))].filter((term) => !hay.has(term)).slice(0, limit);
}

// The live builder meter previously used its own composite formula, which
// could disagree with the checker score saved on the generated resume (meter
// says 94, final resume says 89). Delegate to the SAME scorer the engine and
// the /ats-resume-checker use so the number the user watches climb is the
// number they get. resume-checker is pure/client-safe (data-only imports).
//
// AtsScoreOptions carries the context the checker needs to grade honestly:
// without targetRole/roleSkills the meter stripped 16-26 points (searchability,
// hard skills, coverage) that the generated resume would have earned — the
// "score collapse" the owner saw between drafting and generating.
export type AtsScoreOptions = {
  targetRole?: string;
  targetCompany?: string;
  roleSkills?: string[];
  preferredRoleSkills?: string[];
};

export function atsScore(jd: string, content: RC, options?: AtsScoreOptions): number {
  const safe: RC = {
    ...content,
    skills: content.skills ?? [],
    experiences: content.experiences ?? [],
    education: content.education ?? [],
    projects: content.projects ?? [],
    certifications: content.certifications ?? [],
    languages: content.languages ?? [],
    achievements: content.achievements ?? [],
  };
  // roleSkills falls back to the candidate's own skill list: a resume built
  // against a role title but no JD must never grade its hard skills at 0%
  // when the candidate lists 15 tools — the tools ARE the evidence.
  const roleSkills = options?.roleSkills?.length ? options.roleSkills : safe.skills.length ? safe.skills : undefined;
  return checkResumeContent(safe, {
    jdText: jd?.trim() || undefined,
    targetRole: options?.targetRole?.trim() || safe.headline?.trim() || undefined,
    targetCompany: options?.targetCompany?.trim() || undefined,
    roleSkills,
    preferredRoleSkills: options?.preferredRoleSkills,
  }).score;
}

export type AtsDiagnostics = {
  score: number;
  tip: string;
  keywordCoverage: number;
  missingKeywords: string[];
  quantifiedBullets: number;
  totalBullets: number;
  evidencePrompts: string[];
};

export function atsDiagnostics(jd: string, content: RC, options?: AtsScoreOptions): AtsDiagnostics {
  const resumeText = contentText(content);
  const bullets = content.experiences.flatMap((e) => e.bullets ?? []).concat((content.projects ?? []).map((p) => p.detail)).filter(Boolean);
  const quantifiedBullets = bullets.filter((b) => METRIC_RE.test(b)).length;
  const missingKeywords = missingJdTerms(jd, resumeText, 6);
  const evidencePrompts: string[] = [];
  if (bullets.length && quantifiedBullets / bullets.length < 0.5) {
    evidencePrompts.push("Add measurable results to more bullets: percent improved, time saved, revenue influenced, volume handled, or team size.");
  }
  if (missingKeywords.length) {
    evidencePrompts.push(`Work in supported JD keywords: ${missingKeywords.slice(0, 4).join(", ")}.`);
  }
  if ((content.skills?.length ?? 0) < 6) {
    evidencePrompts.push("Add more role-specific skills so recruiters can find you in keyword search.");
  }
  if (!content.contact?.linkedin && !hasLinkedinLink(content.contact?.links)) {
    evidencePrompts.push("Add a current LinkedIn profile URL so recruiters can verify your professional presence fast.");
  }
  if (!content.summary || content.summary.length < 80) {
    evidencePrompts.push("Strengthen the summary with your exact role, years of experience, and strongest tools.");
  }
  return {
    score: atsScore(jd, content, options),
    tip: topScoreTip(jd, content),
    keywordCoverage: keywordCoverage(jd, resumeText),
    missingKeywords,
    quantifiedBullets,
    totalBullets: bullets.length,
    evidencePrompts: evidencePrompts.slice(0, 3),
  };
}

// The biggest lever to raise the score right now — drives the live meter's tip.
function topScoreTip(jd: string, content: RC): string {
  const bullets = content.experiences.flatMap((e) => e.bullets ?? []).concat((content.projects ?? []).map((p) => p.detail)).filter(Boolean);
  const quantified = bullets.filter((b) => METRIC_RE.test(b)).length;
  if (bullets.length && quantified / bullets.length < 0.5) return "Add a number to your bullets (%, $, count, time) — biggest score jump.";
  if (jd.trim()) {
    const missing = missingJdTerms(jd, contentText(content), 3);
    if (missing.length) return `Work in job-post keywords you actually have: ${missing.join(", ")}.`;
  }
  if ((content.skills?.length ?? 0) < 6) return "List at least 6 relevant skills.";
  if (!content.summary || content.summary.length < 80) return "Add a 2–3 line summary aimed at the role.";
  if (bullets.length < 3) return "Add a few more achievement bullets.";
  return "Looking strong — generate your resume.";
}

// ---- 5-vendor ATS parser simulation + impact bullet synthesizer (2026-10-21) ----

export type AtsVendorVerdict = "pass" | "warn" | "fail";

export type AtsVendorCheck = {
  vendor: "Workday" | "Greenhouse" | "Lever" | "Taleo" | "iCIMS";
  verdict: AtsVendorVerdict;
  /** What THIS vendor's parser is known to choke on, matched against the resume. */
  notes: string[];
};

export type AtsVendorReport = {
  overall: AtsVendorVerdict;
  vendors: AtsVendorCheck[];
};

type VendorProfile = {
  vendor: AtsVendorCheck["vendor"];
  /**
   * Convention: `test` returns TRUE when the resume SATISFIES the vendor's
   * requirement (→ continue, no verdict). When it returns false, the check's
   * verdict fires and the note explains what to fix.
   */
  checks: Array<{ test: (text: string, meta: { tables: boolean; columns: boolean; images: boolean }) => boolean; fail?: AtsVendorVerdict; warn?: AtsVendorVerdict; note: string }>;
};

const VENDOR_PROFILES: VendorProfile[] = [
  {
    vendor: "Workday",
    checks: [
      { test: (t) => /contact/i.test(t) || /@/.test(t), fail: "fail", note: "No contact block detected — Workday drops unattributed resumes." },
      { test: (t) => /\b(experience|employment|work history)\b/i.test(t), fail: "fail", note: "Workday maps sections by standard headings; add an 'Experience' heading." },
      { test: (t, meta) => !meta.columns, warn: "warn", note: "Multi-column layouts risk field scrambling in Workday's text-layer parser." },
    ],
  },
  {
    vendor: "Greenhouse",
    checks: [
      { test: (t) => !/\t/.test(t), warn: "warn", note: "Tab characters in the text layer can split Greenhouse fields." },
      { test: (t) => t.length > 100, fail: "fail", note: "Greenhouse needs an extractable text layer — near-empty text suggests a scanned/image PDF." },
    ],
  },
  {
    vendor: "Lever",
    checks: [
      { test: (t) => !/[^\x20-\x7E\n]/.test(t.replace(/[’‘“”–—•·]/g, "")), warn: "warn", note: "Non-standard glyphs beyond typographic basics can garble Lever's extraction." },
      { test: (t) => /\b(skills?|technolog)/i.test(t), warn: "fail", note: "Lever keyword-searches a Skills section; none detected." },
    ],
  },
  {
    vendor: "Taleo",
    checks: [
      { test: (t) => !/\f/.test(t), warn: "warn", note: "Taleo is form-feed sensitive on older conversions." },
      { test: (t) => t.length < 60_000, fail: "fail", note: "Taleo truncates very large documents; keep the resume under ~15 pages." },
      { test: (t) => /\b\d{4}\b/.test(t), warn: "warn", note: "Taleo prefers explicit 4-digit year ranges on every role." },
    ],
  },
  {
    vendor: "iCIMS",
    checks: [
      { test: (t) => !/\|{2,}/.test(t), warn: "warn", note: "Pipe-drawn table borders parse as garbage characters in iCIMS." },
      { test: (t) => /\b(name|email|phone)\b/i.test(t) || /@/.test(t), fail: "fail", note: "iCIMS requires identifiable candidate fields (email/phone) in the body." },
    ],
  },
];

/**
 * Deterministic 5-vendor parser simulation. Zero LLM cost: every check is a
 * plain text/structure probe on the extractable resume text, so the free tier
 * can show the ATS X-Ray without spending a model call.
 */
export function evaluateAtsVendorCompatibility(resumeText: string, parsedMeta?: { tables?: boolean; columns?: boolean; images?: boolean }): AtsVendorReport {
  const text = resumeText.slice(0, 80_000);
  const meta = { tables: parsedMeta?.tables ?? false, columns: parsedMeta?.columns ?? false, images: parsedMeta?.images ?? false };
  const vendors: AtsVendorCheck[] = VENDOR_PROFILES.map((profile) => {
    let verdict: AtsVendorVerdict = "pass";
    const notes: string[] = [];
    for (const check of profile.checks) {
      if (check.test(text, meta)) continue;
      const v = (check.fail ?? check.warn ?? "warn") as AtsVendorVerdict;
      // worst verdict wins: fail > warn > pass
      if (v === "fail" || (v === "warn" && verdict === "pass")) verdict = v;
      notes.push(check.note);
    }
    return { vendor: profile.vendor, verdict, notes };
  });
  const overall: AtsVendorVerdict = vendors.some((v) => v.verdict === "fail") ? "fail" : vendors.some((v) => v.verdict === "warn") ? "warn" : "pass";
  return { overall, vendors };
}

// ---- Impact bullet synthesizer: flagged duty bullets get an editable,
// zero-fabrication template with explicit metric slots. The candidate fills
// the brackets with their real numbers — we never invent one. ----

export type BulletIssueType = "passive_duty" | "missing_metric" | "we_vagueness" | "weak_verb" | "wall_of_text";

export type BulletSynthesis = {
  issueType: BulletIssueType;
  rewrittenTemplate: string;
  estimatedScoreGain: number;
};

const DUTY_VERBS = /\b(responsible for|responsible to|duties included|tasked with|in charge of)\b/i;
const WE_START = /^we\s+/i;
const WEAK_VERBS = /\b(worked on|helped with|assisted (?:with|in)|involved in|participated in|handled)\b/i;

export function classifyBullet(bullet: string): BulletIssueType {
  if (bullet.split(/\s+/).length > 45) return "wall_of_text";
  if (WE_START.test(bullet.trim())) return "we_vagueness";
  if (DUTY_VERBS.test(bullet)) return "passive_duty";
  if (WEAK_VERBS.test(bullet)) return "weak_verb";
  if (!METRIC_RE.test(bullet)) return "missing_metric";
  return "missing_metric";
}

/** Strips the flagged opener and extracts the subject phrase for templating. */
function corePhrase(bullet: string): string {
  return bullet
    .replace(DUTY_VERBS, "")
    .replace(WEAK_VERBS, "")
    .replace(/^[\s,:-]+/, "")
    .replace(/\.$/, "")
    .trim();
}

/**
 * Builds an editable rewrite template with bracketed metric slots. The slots
 * ([X%], [$X], [N/wk]) are the anti-fabrication contract: the tool proposes
 * the SHAPE of an impact statement; only the candidate can supply the number.
 */
export function synthesizeBullet(bullet: string, issueType: BulletIssueType): BulletSynthesis {
  const core = corePhrase(bullet);
  const short = core.length > 90 ? core.slice(0, 87).trim() + "…" : core;
  const templates: Record<BulletIssueType, BulletSynthesis> = {
    passive_duty: {
      issueType,
      rewrittenTemplate: `Owned ${short}, improving [X%] within [N months]`,
      estimatedScoreGain: 5,
    },
    missing_metric: {
      issueType,
      rewrittenTemplate: `${short.replace(/\.$/, "")}, delivering [X%] improvement across [N] teams`,
      estimatedScoreGain: 6,
    },
    we_vagueness: {
      issueType,
      rewrittenTemplate: `Led ${short.replace(/^we\s+/i, "")}, generating [$X] in [savings/revenue] per [N/wk]`,
      estimatedScoreGain: 4,
    },
    weak_verb: {
      issueType,
      rewrittenTemplate: `Drove ${short}, cutting [time/cost] by [X%]`,
      estimatedScoreGain: 4,
    },
    wall_of_text: {
      issueType,
      rewrittenTemplate: `${short.split(/[;,]/)[0].trim()}, achieving [X%] [outcome]`,
      estimatedScoreGain: 3,
    },
  };
  return templates[issueType];
}

export type BulletRepair = {
  original: string;
} & BulletSynthesis;

/** Convenience for the fixer UI: classify + template in one call. */
export function repairBullet(bullet: string): BulletRepair {
  const issueType = classifyBullet(bullet);
  return { original: bullet, ...synthesizeBullet(bullet, issueType) };
}
