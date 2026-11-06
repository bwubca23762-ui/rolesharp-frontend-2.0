import type { ResumeContent } from "./types";
import { companyGuidance, type CompanyType } from "./resume-guidance";
import { benchmarkPercentile } from "./score-benchmark";

const STOP = new Set([
  "the", "and", "for", "with", "you", "our", "are", "will", "this", "that", "have", "from", "your",
  "role", "team", "work", "ability", "candidate", "ideal", "including", "across", "using", "within",
  "strong", "support", "required", "requiring", "preferred", "experience", "years", "job", "description",
  "responsibilities", "requirements", "qualifications", "applicant", "company", "business", "must",
  "hiring", "has", "experiences", "skills", "testing", "delivery", "partner",
  "develop", "developing", "test", "maintain", "maintaining", "build", "building",
  "write", "writing", "clean", "efficient", "collaborate", "collaborating", "functional",
  "improve", "improving", "participate", "responsible", "looking", "seeking", "join",
  // JD-prose words that appeared in real "missing keywords" advice and made
  // resumes worse: fragments of sentences like "own our payments ledger",
  // "Nice to have", "exactly-once semantics", "prior fintech experience".
  "own", "owns", "owning", "similar", "similarly", "nice", "necessarily", "exactly",
  "once", "prior", "prioritize", "scale", "scaling", "scaled", "infrastructure",
  "distributed", "streaming", "streamline", "financial", "observability", "tooling",
  "toolkit", "ensure", "ensuring", "help", "helps", "helping", "also", "both",
  "other", "others", "new", "well", "best", "good", "great", "plus", "etc",
  "per", "via", "across", "toward", "towards", "every", "each", "highly", "deeply",
]);

const ACTION_VERBS = [
  "achieved", "analyzed", "architected", "automated", "built", "championed", "created", "delivered",
  "designed", "developed", "drove", "engineered", "implemented", "improved", "increased", "launched",
  "led", "managed", "mentored", "optimized", "owned", "partnered", "prepared", "processed",
  "reconciled", "reduced", "reported", "resolved", "shipped", "streamlined",
  "trained", "validated", "coordinated", "forecasted", "audited", "deployed", "maintained",
  "wrote", "presented", "authored", "spearheaded", "generated", "produced", "researched",
  "negotiated", "published", "modernized", "migrated", "scaled",
];

const WEAK_WORDS = ["responsible for", "worked on", "helped with", "assisted with", "participated in", "hard working", "go getter"];
// Exported so the recruiter read flags the same phrases the score penalises,
// instead of keeping a second list that can drift out of agreement with it.
export const WEAK_PHRASES = WEAK_WORDS;
const FIRST_PERSON = /\b(i|me|my|mine|we|our)\b/i;
const PRIVATE_RISK = /\b(date of birth|dob|marital status|religion|caste|father'?s name|mother'?s name|passport|aadhaar|aadhar|ssn|social security)\b/i;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9-_%]+\/?/i;
const GLOBAL_KEYWORDS = [
  "communication", "collaboration", "leadership", "analysis", "reporting", "customer", "project",
  "process", "quality", "compliance", "data", "operations", "stakeholder", "problem", "documentation",
];
// Single source of truth for recognized hard skills: the hint regex tests JD
// terms, and the same list is scanned against the resume text itself when
// neither a JD nor role skills supplied hard terms (Pillar 2: a technical
// candidate with 15 tools but no pasted JD must not grade 0%).
const HARD_SKILL_TERMS = [
  "sql", "python", "java", "javascript", "typescript", "react", "node", "node.js", "express", "next.js",
  "go", "golang", "rust", "ruby", "php", "c++", "c#", ".net", "kotlin", "swift", "scala", "r", "matlab",
  "excel", "tableau", "power bi", "powerbi", "looker", "tally", "quickbooks", "gst", "aws", "azure",
  "gcp", "google cloud", "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "ci/cd",
  "git", "github", "gitlab", "linux", "bash", "unix", "mongodb", "postgresql", "postgres", "mysql",
  "redis", "kafka", "rabbitmq", "graphql", "grpc", "rest", "api", "microservices", "spark", "hadoop",
  "snowflake", "airflow", "dbt", "figma", "adobe", "photoshop", "salesforce", "sap", "oracle",
  "servicenow", "hubspot", "analytics", "seo", "sem", "reconciliation", "audit", "tax", "payroll",
  "crm", "erp", "jira", "confluence", "postman", "selenium", "cypress", "playwright",
];
const HARD_SKILL_HINTS = new RegExp(
  `\\b(?:${HARD_SKILL_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "i",
);
const SOFT_SKILL_HINTS = /\b(communication|leadership|collaboration|teamwork|stakeholder|stakeholders|problem solving|problem-solving|adaptability|ownership|presentation|presentations|mentoring|planning|negotiation|time management|critical thinking|attention to detail)\b/i;
const NON_RESUME_HINTS = [
  /\bchapter\s+\d+\b/i,
  /\b(system architecture|three-layer architecture|presentation layer|application layer|data layer)\b/i,
  /\b(data flow diagram|dfd level|entity-relationship diagram|er diagram)\b/i,
  /\b(figure\s+\d|diagram description|database schema|database normalization)\b/i,
  /\b(route handling|request processing|session management|sqlite database)\b/i,
  /\b(table of contents|abstract|literature review|methodology)\b/i,
];

export type CheckInput = {
  resumeText: string;
  targetRole?: string;
  targetCompany?: string;
  jdText?: string;
  country?: string;
  roleSkills?: string[];
  preferredRoleSkills?: string[];
  companyType?: CompanyType;
};

type CheckItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type KeywordGroup = {
  label: string;
  found: string[];
  missing: string[];
  coverage: number;
};

export type CheckResult = {
  score: number;
  grade: "Excellent" | "Strong" | "Needs work" | "Weak";
  /** Share of scored resumes this beats, or null when the corpus is too small
   * to support the claim. See lib/score-benchmark.ts — this used to be a
   * hardcoded ladder presented to users as "Top 8% risk-adjusted". */
  percentile: number | null;
  confidence: "High" | "Medium" | "Low";
  verdict: string;
  breakdown: { label: string; score: number; max: number; note: string }[];
  checks: CheckItem[];
  strengths: string[];
  fixes: string[];
  quickWins: string[];
  missingKeywords: string[];
  /** Weak-phrased + unquantified-claim bullets, raw text, capped — feeds the checker's per-bullet "Fix with AI" action. */
  flaggedBullets: string[];
  keywordGroups: KeywordGroup[];
  detected: Record<string, boolean | number | string>;
  companyGuidance: ReturnType<typeof companyGuidance>;
};

function resumeContentText(content: ResumeContent): string {
  return [
    content.headline,
    [content.contact?.email, content.contact?.phone, content.contact?.location, content.contact?.linkedin, ...(content.contact?.links ?? [])].filter(Boolean).join(" | "),
    "Professional Summary",
    content.summary,
    "Skills",
    content.skills.join(" | "),
    "Experience",
    ...content.experiences.flatMap((experience) => [
      [experience.title, experience.company, experience.period].filter(Boolean).join(" | "),
      ...experience.bullets.map((bullet) => `• ${bullet}`),
    ]),
    // Fresh graduates put multiple achievements in one project paragraph. A
    // single 300-char line ate long-bullet penalties (-6 readability) and hid
    // metrics/action verbs inside prose the parser read as one bullet. Split
    // multi-sentence details into per-sentence bullet lines so projects are
    // graded the same way experience bullets are.
    ...(content.projects.length ? ["Projects", ...content.projects.flatMap((project) => {
      const sentences = (project.detail || "")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 15);
      return sentences.length > 1
        ? [project.name, ...sentences.map((s) => `• ${s.replace(/^[•●▪*-\s]+/, "")}`)]
        : [project.name, `• ${project.detail}`];
    })] : []),
    "Education",
    ...content.education.map((item) => [item.degree, item.school, item.year, item.detail].filter(Boolean).join(" | ")),
    ...(content.certifications.length ? ["Certifications", ...content.certifications] : []),
    // Achievements render as plain lines, not bullets — awards like "Analyst of
    // the Quarter" can't start with an action verb or carry a metric, and
    // counting them as bullets unfairly dilutes the impact ratios.
    ...(content.achievements.length ? ["Achievements", ...content.achievements] : []),
    ...(content.languages.length ? ["Languages", content.languages.join(" | ")] : []),
  ].filter(Boolean).join("\n");
}

export function checkResumeContent(content: ResumeContent, target: Omit<CheckInput, "resumeText"> = {}): CheckResult {
  return checkResume({ ...target, resumeText: resumeContentText(content) });
}

function words(text: string) {
  return text.toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) ?? [];
}

function uniqueTerms(text: string) {
  return [...new Set(words(text).map((w) => w.replace(/[.]+$/g, "")).filter((w) => w && !STOP.has(w)))];
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function status(score: number, warn = 0.65): CheckItem["status"] {
  if (score >= 0.9) return "pass";
  if (score >= warn) return "warn";
  return "fail";
}

function has(text: string, re: RegExp) {
  return re.test(text);
}

function lines(text: string) {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

// Word/Canva/LibreOffice exports use many bullet glyphs (●, ▪, ‣, ◦, –, —).
// Only recognizing -•* silently dropped every bullet in those resumes and
// tanked the impact score by ~20 points on otherwise perfect documents.
const BULLET_MARK = /^[-•*‣▪●○◦·–—]\s+/;

function bullets(text: string) {
  const all = lines(text);
  const marked = all.filter((l) => BULLET_MARK.test(l));
  return marked.length ? marked : all.filter((l) => l.length >= 35 && l.length <= 260).slice(0, 40);
}

/** Same bullet extraction the score uses, so the recruiter read quotes the
 * exact lines that were graded rather than a second guess at what a bullet is. */
export const extractBullets = bullets;

function realResumeBullets(text: string) {
  const all = lines(text);
  const marked = all.filter((l) => BULLET_MARK.test(l));
  if (marked.length) return marked;
  return all.filter((l) => {
    const clean = l.toLowerCase().replace(/^\d+[.)]\s+/, "");
    const startsWithAction = ACTION_VERBS.some((v) => clean.startsWith(v));
    return startsWithAction && l.length >= 35 && l.length <= 260;
  });
}

function sectionPresent(text: string, names: string[]) {
  const re = new RegExp(`(^|\\n)\\s*(${names.join("|")})\\s*:?\\s*(\\n|$)`, "i");
  return re.test(text);
}

// "2019 - 2022" satisfies any reasonable phone pattern, so every resume with an
// employment date range was credited with a phone number it did not have —
// worth 3 points of Contact and a recruiter note saying they could call you.
// Strip date ranges before looking for a number.
const DATE_RANGE = /\b(?:19|20)\d{2}\s*[-–—to]{1,3}\s*(?:(?:19|20)\d{2}|present|current)\b/gi;
function hasPhone(text: string) {
  return /(\+?\d[\d\s().-]{7,}\d)/.test(text.replace(DATE_RANGE, " "));
}

function countNonResumeSignals(text: string) {
  return NON_RESUME_HINTS.filter((re) => re.test(text)).length;
}

function extractDates(text: string) {
  return text.match(/\b(20\d{2}|19\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|present|current)\b/gi) ?? [];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Verbatim JD-copy detection: shingle the JD into 10-word windows and measure
// how many appear word-for-word in the resume. Honest tailoring shares terms,
// not whole sentences — high overlap means the user pasted the JD into the
// resume (the classic "white text" ATS cheat), which real ATSes now flag.
function jdCopyRatio(resumeText: string, jdText?: string): number {
  if (!jdText) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const jdWords = norm(jdText).split(" ").filter(Boolean);
  if (jdWords.length < 40) return 0;
  const hay = norm(resumeText);
  let hits = 0, total = 0;
  for (let i = 0; i + 10 <= jdWords.length; i += 5) {
    total++;
    if (hay.includes(jdWords.slice(i, i + 10).join(" "))) hits++;
  }
  return total ? hits / total : 0;
}

// Non-Latin script share of the letters. The analyzer's keyword/verb/section
// logic is English-tuned; confidently grading a Hindi or Arabic resume "Weak"
// is wrong — flag it and lower confidence instead.
function nonLatinRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return 0;
  const latin = letters.filter((c) => /[a-z]/i.test(c)).length;
  return 1 - latin / letters.length;
}

const TERM_ALIASES: Record<string, string[]> = {
  "ci/cd": ["continuous integration", "continuous delivery", "continuous deployment"],
  "customer relationship management": ["crm"],
  "enterprise resource planning": ["erp"],
  "javascript": ["java script"],
  "machine learning": ["ml"],
  "power bi": ["powerbi"],
  "software as a service": ["saas"],
};

function normalizeTerm(value: string) {
  return value.toLowerCase().replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
}

// Whole-token/phrase matching avoids false positives such as Java matching
// JavaScript or R matching every word containing the letter. Conservative
// aliases cover only established spelling/acronym equivalents.
// Exported for the skill gap, which asks the same question of the same text —
// "does this resume evidence this skill?" — and must get the same answer. A
// second matcher would disagree with the score the moment either changed, the
// way a second weak-phrase list would (see WEAK_PHRASES above).
export function termPresent(hay: string, term: string) {
  const candidates = [term, ...(TERM_ALIASES[normalizeTerm(term)] ?? [])].map(normalizeTerm);
  return candidates.some((candidate) => {
    if (!candidate) return false;
    const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegex(candidate)}($|[^a-z0-9+#])`, "i");
    return re.test(hay);
  });
}

function keywordGroup(label: string, terms: string[], hay: string): KeywordGroup {
  const unique = [...new Set(terms.map(normalizeTerm).filter(Boolean))].slice(0, 40);
  const found = unique.filter((t) => termPresent(hay, t));
  const missing = unique.filter((t) => !termPresent(hay, t)).slice(0, 16);
  return { label, found, missing, coverage: unique.length ? clamp((found.length / unique.length) * 100) : 0 };
}

function grade(score: number): CheckResult["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Needs work";
  return "Weak";
}



export function checkResume(input: CheckInput): CheckResult {
  // Hard cap the analyzed length — defense in depth against oversized inputs
  // reaching the regex passes even if a caller forgets API-level limits.
  const text = input.resumeText.slice(0, 40000).replace(/\r/g, "").trim();
  const lower = text.toLowerCase();
  const wordList = words(text);
  // Real word count for the length check: words() drops numbers and 1-2 letter
  // words, which made metric-dense resumes look ~40% shorter than they are and
  // unfairly triggered the "too short" penalty on quantified resumes.
  const wordCount = (text.match(/[A-Za-z0-9][A-Za-z0-9+#.%$-]*/g) ?? []).length;
  const bulletList = bullets(text);
  const realBulletList = realResumeBullets(text);
  const dates = extractDates(text);
  const roleSkillTerms = [...(input.roleSkills ?? []), ...(input.preferredRoleSkills ?? [])];
  const target = [input.targetRole, input.targetCompany, input.jdText, ...roleSkillTerms].filter(Boolean).join(" ");
  const targetTerms = uniqueTerms(target || GLOBAL_KEYWORDS.join(" ")).slice(0, 90);
  const hardTerms = [...new Set([...roleSkillTerms, ...targetTerms.filter((t) => HARD_SKILL_HINTS.test(t))])].slice(0, 40);
  // Pillar 2 fallback: no JD pasted and no role skill bank (half of builders
  // target a title only). Mining the resume text itself for recognized hard
  // skills grades a technical resume on its own evidence instead of
  // manufacturing an automatic 0% / FAIL for coverage it actually has.
  const resumeHardSkills = HARD_SKILL_TERMS.filter((term) => termPresent(lower, term));
  const hardGroup: KeywordGroup & { extracted?: boolean } =
    hardTerms.length >= 2
      ? keywordGroup("Hard skills", hardTerms, lower)
      : resumeHardSkills.length >= 4
        ? keywordGroup("Hard skills", resumeHardSkills.slice(0, 20), lower)
        : { label: "Hard skills", found: resumeHardSkills.slice(0, 4), missing: [], coverage: 0, extracted: false };
  const softTerms = targetTerms.filter((t) => SOFT_SKILL_HINTS.test(t)).slice(0, 30);
  const globalTerms = uniqueTerms(GLOBAL_KEYWORDS.join(" "));
  const targetGroup = keywordGroup("Target keywords", targetTerms, lower);
  const requiredGroup = keywordGroup("Role-required skills", input.roleSkills ?? [], lower);
  const preferredGroup = keywordGroup("Role-preferred skills", input.preferredRoleSkills ?? [], lower);
  const softGroup = keywordGroup("Soft skills", softTerms.length ? softTerms : globalTerms, lower);
  // Missing-keyword advice must come from groups with real extraction only —
  // never from a fallback list of generic prose words.
  const missingKeywords = [...new Set([
    ...(hardTerms.length >= 2 ? hardGroup.missing : []),
    ...targetGroup.missing,
  ])].slice(0, 18);

  // Copy-pasting one strong bullet 40 times used to buy a "Strong" grade —
  // duplicates must not count toward volume or ratios.
  const uniqueBullets = [...new Set(realBulletList.map((b) => b.toLowerCase().replace(BULLET_MARK, "").replace(/\s+/g, " ").trim()))];
  const duplicateBulletRatio = realBulletList.length ? 1 - uniqueBullets.length / realBulletList.length : 0;
  // Any digit counts as quantification — same definition as the builder's live
  // METRIC_RE. The old noun-list regex rejected obviously-quantified bullets
  // like "Built 14 dashboards" or "40+ weekly reports" and made the checker
  // disagree with the meter.
  const metricBullets = uniqueBullets.filter((b) => /(\d|%|\$|₹|\bfrom .+? to )/i.test(b));
  // Credibility check (GROWTH-PLAN Phase 1): outcome claims with nothing
  // behind them. "Led", "improved", "increased" without a number is the
  // exact bullet an interviewer probes first — the check names the gap
  // instead of just counting metrics.
  const claimVerbs = /\b(led|improved|increased|reduced|saved|boosted|grew|delivered|managed|drove|streamlined)\b/i;
  const unquantifiedClaims = uniqueBullets.filter((b) => !/(\d|%|\$|₹|\bfrom .+? to )/i.test(b) && claimVerbs.test(b)).length;
  const actionBullets = uniqueBullets.filter((b) => ACTION_VERBS.some((v) => b.replace(/^\d+[.)]\s+/, "").startsWith(v)));
  const jdCopy = jdCopyRatio(text, input.jdText);
  const nonEnglish = nonLatinRatio(text) > 0.4;
  const weakBullets = bulletList.filter((b) => WEAK_WORDS.some((w) => b.toLowerCase().includes(w)));
  const longBullets = bulletList.filter((b) => b.length > 230);
  const shortBullets = bulletList.filter((b) => b.length < 35);
  const nonResumeSignals = countNonResumeSignals(text);
  const targetCompanyGuidance = companyGuidance(input.companyType);
  const missingGovernmentHours = input.companyType === "government" && !/\b\d{1,3}\s*(?:hours?\s*\/\s*week|hours? per week|hrs?\s*\/\s*week)\b/i.test(text);

  const detected = {
    // Domain part must NOT allow "." inside the first quantified class — the
    // old pattern ([A-Z0-9.-]+\.[A-Z]{2,}) backtracked quadratically on inputs
    // like "a@...(30K dots)" (measured 500ms+ per request = DoS vector).
    email: has(text, /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z]{2,24})+/i),
    phone: hasPhone(text),
    linkedin: has(text, LINKEDIN_RE),
    // Location matching needs two patterns: country/remote words match any
    // case (i-flag), while "City, ST" must stay case-sensitive — a blanket /i
    // on [A-Z]{2} matched any two-letter word after a comma ("Hello, my").
    // The case-sensitive branch credits standard formats like "San Francisco,
    // CA", "Austin, TX", "Toronto, ON" that the old title-case-only pattern
    // dropped (-2 contact points).
    location: has(text, /\b(india|united states|usa|uk|canada|australia|germany|singapore|dubai|uae|remote|hybrid|onsite)\b/i) || has(text, /\b[A-Z][a-zA-Z]+,\s*(?:[A-Z][a-zA-Z]+|[A-Z]{2})\b/),
    metrics: metricBullets.length,
    actionBullets: actionBullets.length,
    weakBullets: weakBullets.length,
    longBullets: longBullets.length,
    shortBullets: shortBullets.length,
    summary: sectionPresent(text, ["summary", "profile", "objective", "professional summary"]),
    skills: sectionPresent(text, ["skills", "technical skills", "core skills"]),
    experience: sectionPresent(text, ["experience", "work experience", "employment", "internship", "professional experience"]),
    education: sectionPresent(text, ["education", "academic", "qualification", "qualifications"]),
    projects: sectionPresent(text, ["projects", "academic projects", "personal projects"]),
    certifications: sectionPresent(text, ["certifications", "certificates", "licenses"]),
    dates: dates.length,
    wordCount,
    bulletCount: bulletList.length,
    realBulletCount: realBulletList.length,
    nonResumeSignals,
    firstPerson: FIRST_PERSON.test(text),
    privacyRisk: PRIVATE_RISK.test(text),
    tableRisk: /[│┌┬┐└┴┘]|\t{2,}| {8,}/.test(text),
    linkCount: (text.match(/https?:\/\//g) ?? []).length,
    uppercaseDensity: wordList.length ? clamp((wordList.filter((w) => w === w.toUpperCase() && w.length > 3).length / wordList.length) * 100) : 0,
  };

  const contactScore = (detected.email ? 3 : 0) + (detected.phone ? 3 : 0) + (detected.location ? 2 : 0) + (detected.linkedin ? 2 : 0);
  const resumeSectionCount = [
    detected.summary,
    detected.skills,
    detected.experience,
    detected.education,
    detected.projects,
    detected.certifications,
  ].filter(Boolean).length;
  const isLikelyNonResume = nonResumeSignals >= 3 && contactScore < 4 && resumeSectionCount < 3;
  const sectionScore =
    (detected.summary ? 2 : 0) +
    (detected.skills ? 3 : 0) +
    ((detected.experience || detected.projects) ? 4 : 0) +
    (detected.education ? 2 : 0) +
    (detected.certifications ? 1 : 0);
  const authenticityScore =
    15 -
    (isLikelyNonResume ? 10 : 0) -
    (nonResumeSignals ? Math.min(4, nonResumeSignals) : 0) -
    (contactScore === 0 ? 2 : 0) -
    (resumeSectionCount < 2 ? 3 : 0) +
    Math.min(4, sectionScore * 0.35);
  // Coverage curve: no real ATS demands 100% of ~90 JD terms. 85%+ coverage of
  // supported keywords is a fully-optimized resume, so it earns full marks —
  // otherwise the score has a mechanical ceiling near 90 that even a perfect
  // candidate cannot break through.
  const curved = (coverage: number) => Math.min(100, (coverage / 85) * 100);
  // Pillar 3 — JD cliff smoothing. Pasting a JD explodes the target-keyword
  // denominator from ~15 global terms to ~80 JD terms, so an identical draft
  // collapsed 15-25 points the moment a JD appeared. Blend instead of cliff:
  // general keyword strength still counts for 40%, and the JD curve for 60%,
  // so a JD adds targeted suggestions and upward trajectory without crashing
  // the score. The raw group (and its honest missing list) still shows the
  // JD-only coverage to the user — only the scored value is smoothed.
  const coreGroup = keywordGroup("Core keywords", globalTerms, lower);
  const hasLongJd = Boolean(input.jdText && input.jdText.length > 50);
  const effectiveTargetCoverage = hasLongJd
    ? Math.min(100, Math.max(
        targetGroup.coverage,
        (coreGroup.coverage * 0.4) + (curved(targetGroup.coverage) * 0.6),
      ))
    : targetGroup.coverage;
  const keywordScore = (curved(effectiveTargetCoverage) * 0.5 + curved(hardGroup.coverage) * 0.35 + curved(softGroup.coverage) * 0.15) * 0.2;
  // Impact curve: quantified outcomes in half the bullets and action verbs in
  // 80% is elite resume writing. The builder already teaches a 50% target;
  // requiring 70% here contradicted that guidance and pushed factual, polished
  // resumes below 95 unless users repeated the same number unnaturally.
  // Volume bonus saturates at 6 real bullets instead of 10 so strong two-role
  // profiles aren't penalized for not padding.
  const impactScore = uniqueBullets.length
    ? Math.min(20, Math.max(0,
        Math.min(1, (metricBullets.length / uniqueBullets.length) / 0.5) * 8 +
        Math.min(1, (actionBullets.length / uniqueBullets.length) / 0.8) * 7 +
        Math.min(5, (uniqueBullets.length / 6) * 5) -
        weakBullets.length * 0.7))
    : 0;
  // Graded word-count penalty: a hard -4 cliff at 250 words punished concise,
  // dense two-role resumes that are otherwise perfect. Truly thin documents
  // (<180 words) still take the full penalty.
  const atsScore =
    15 -
    (wordCount < 180 ? 4 : wordCount < 250 ? 2 : 0) -
    (wordCount > 1000 ? 3 : 0) -
    (detected.tableRisk ? 4 : 0) -
    (Number(detected.linkCount) > 6 ? 2 : 0) -
    (detected.privacyRisk ? 3 : 0) -
    (detected.firstPerson ? 1 : 0);
  // Word-boundary match on the role's first word — .includes gave "IT Support"
  // free points from any word containing "it". escapeRegex also prevents a
  // crash on roles like "C++ Developer".
  const roleFirstWord = input.targetRole?.toLowerCase().split(/\s+/)[0] ?? "";
  const roleWordRe = roleFirstWord ? new RegExp(`\\b${escapeRegex(roleFirstWord)}\\b`, "i") : null;
  const searchabilityScore =
    (roleWordRe && roleWordRe.test(lower) ? 3 : 0) +
    (dates.length >= 2 ? 2 : 0) +
    // Absolute counts bias against short JDs and non-tech roles (the hard-skill
    // regex is tech-heavy); coverage % is the fair alternative signal.
    (targetGroup.found.length >= 8 || effectiveTargetCoverage >= 60 ? 3 : 0) +
    (hardGroup.found.length >= 4 || hardGroup.coverage >= 60 ? 2 : 0);
  const readabilityScore =
    10 -
    (longBullets.length ? Math.min(4, longBullets.length) : 0) -
    (shortBullets.length > 4 ? 2 : 0) -
    (Number(detected.uppercaseDensity) > 8 ? 2 : 0) -
    // Only long BULLET lines hurt scanability. A 2-3 sentence summary is one
    // "line" in extracted text and used to eat -2 on every generated resume.
    (bulletList.some((l) => l.length > 200) ? 2 : 0);

  const breakdown = [
    { label: "Contact", score: clamp(contactScore, 0, 10), max: 10, note: "Email, phone, location, and professional profile links." },
    { label: "Resume proof", score: clamp(authenticityScore, 0, 15), max: 15, note: "Confirms the file looks like a real resume, not a report, chapter, or random document." },
    { label: "Keyword match", score: clamp(keywordScore, 0, 20), max: 20, note: "Company, role, hard skills, soft skills, and JD phrase coverage." },
    { label: "Impact", score: clamp(impactScore, 0, 20), max: 20, note: "Action verbs, quantified outcomes, and bullet substance." },
    { label: "ATS safety", score: clamp(atsScore, 0, 15), max: 15, note: "Parser-friendly length, formatting, links, and privacy safety." },
    { label: "Searchability", score: clamp(searchabilityScore, 0, 10), max: 10, note: "Recruiter keyword search signals such as titles, skills, and dates." },
    { label: "Readability", score: clamp(readabilityScore, 0, 10), max: 10, note: "Bullet length, scanability, and concise writing style." },
  ];
  const rawScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  // Anti-gaming penalties: verbatim JD copying (white-text cheat) and heavy
  // duplicate bullets both cap what stuffing can buy.
  const jdCopyPenalty = jdCopy > 0.5 ? 20 : jdCopy > 0.25 ? 12 : 0;
  const duplicatePenalty = duplicateBulletRatio > 0.4 ? 10 : duplicateBulletRatio > 0.2 ? 5 : 0;
  const score = clamp(rawScore - (isLikelyNonResume ? 25 : 0) - (resumeSectionCount === 0 ? 8 : 0) - (missingGovernmentHours ? 5 : 0) - jdCopyPenalty - duplicatePenalty);
  const resultGrade = grade(score);

  const checks: CheckItem[] = [
    { id: "document-type", label: "Resume document type", status: isLikelyNonResume ? "fail" : nonResumeSignals ? "warn" : "pass", detail: isLikelyNonResume ? "This appears to be a report/chapter or non-resume document, not a job resume." : nonResumeSignals ? "Some non-resume terms were found; remove unrelated report content." : "Document looks like a resume." },
    { id: "email", label: "Professional email", status: detected.email ? "pass" : "fail", detail: detected.email ? "Email found." : "Add a professional email in the header." },
    { id: "phone", label: "Phone number", status: detected.phone ? "pass" : "fail", detail: detected.phone ? "Phone found." : "Add a phone number recruiters can use." },
    { id: "location", label: "Location/market", status: detected.location ? "pass" : "warn", detail: detected.location ? "Location signal found." : "Add city/country or remote preference." },
    { id: "linkedin", label: "LinkedIn profile", status: detected.linkedin ? "pass" : "warn", detail: detected.linkedin ? "LinkedIn profile found." : "Add a clean LinkedIn profile URL if it matches your current career story." },
    { id: "summary", label: "Summary/profile", status: detected.summary ? "pass" : "warn", detail: detected.summary ? "Summary section found." : "Add a 2-4 line summary aligned to the target role." },
    { id: "skills", label: "Skills section", status: detected.skills ? "pass" : "fail", detail: detected.skills ? "Skills section found." : "Add a Skills section with tools and hard skills." },
    { id: "evidence", label: "Experience or projects", status: (detected.experience || detected.projects) ? "pass" : "fail", detail: "ATS and recruiters need proof of work: jobs, internships, or projects." },
    { id: "education", label: "Education", status: detected.education ? "pass" : "warn", detail: detected.education ? "Education found." : "Add education, especially for students and fresh graduates." },
    { id: "dates", label: "Dates", status: status(Math.min(1, dates.length / 2)), detail: dates.length ? `${dates.length} date signals found.` : "Add dates/years to education and experience." },
    { id: "hard-skills", label: "Hard skill match", status: status(hardGroup.coverage / 100, 0.45), detail: `${hardGroup.coverage}% hard-skill coverage.` },
    { id: "target-match", label: "Target keyword match", status: status(effectiveTargetCoverage / 100, 0.5), detail: hasLongJd ? `${effectiveTargetCoverage}% effective target coverage (raw JD coverage ${targetGroup.coverage}%).` : `${targetGroup.coverage}% target keyword coverage.` },
    { id: "metrics", label: "Metrics in bullets", status: status(metricBullets.length / Math.max(1, Math.min(6, realBulletList.length)), 0.35), detail: `${metricBullets.length} real resume bullets include measurable outcomes.` },
    { id: "credibility", label: "Credibility check", status: unquantifiedClaims > uniqueBullets.length * 0.6 ? "warn" : "pass", detail: uniqueBullets.length && unquantifiedClaims > uniqueBullets.length * 0.6 ? `${unquantifiedClaims} of ${uniqueBullets.length} outcome bullets claim results with no number behind them. An interviewer will probe exactly these — add the metric you can defend, or the honest observation, to each.` : "Outcome bullets carry defensible evidence. Interviewers probe claims; these hold." },
    { id: "action-verbs", label: "Action verbs", status: status(actionBullets.length / Math.max(1, Math.min(6, realBulletList.length)), 0.45), detail: `${actionBullets.length} real resume bullets start with strong action verbs.` },
    { id: "weak-phrases", label: "Weak phrasing", status: weakBullets.length ? "warn" : "pass", detail: weakBullets.length ? "Replace passive phrases like responsible for/worked on." : "No obvious weak phrasing found." },
    { id: "length", label: "Resume length", status: wordCount >= 300 && wordCount <= 900 ? "pass" : wordCount >= 230 && wordCount <= 1050 ? "warn" : "fail", detail: `${wordCount} words detected.` },
    { id: "tables", label: "ATS layout risk", status: detected.tableRisk ? "fail" : "pass", detail: detected.tableRisk ? "Tables/columns or unusual spacing may hurt parsing." : "No major table/column text risk found." },
    { id: "privacy", label: "Bias/privacy risk", status: detected.privacyRisk ? "fail" : "pass", detail: detected.privacyRisk ? "Remove personal details like DOB, marital status, religion, IDs." : "No common privacy-risk fields found." },
    { id: "first-person", label: "Resume voice", status: detected.firstPerson ? "warn" : "pass", detail: detected.firstPerson ? "Avoid first-person pronouns in resume bullets." : "Professional resume voice looks clean." },
    ...(jdCopy > 0.25 ? [{ id: "jd-copy", label: "Copied job description", status: "fail" as const, detail: "Large parts of the job description appear verbatim in the resume. Modern ATS and recruiters flag this — describe your own experience using the JD's terms instead." }] : []),
    ...(duplicateBulletRatio > 0.2 ? [{ id: "duplicate-bullets", label: "Repeated bullets", status: "warn" as const, detail: "Several bullets are duplicates. Each bullet should cover a distinct achievement." }] : []),
    ...(nonEnglish ? [{ id: "language", label: "Non-English resume", status: "warn" as const, detail: "This resume appears to be mostly non-English. The analysis is tuned for English resumes, so treat this score as unreliable." }] : []),
    ...(input.companyType === "government" ? [{ id: "government-hours", label: "Hours per week", status: missingGovernmentHours ? "fail" as const : "pass" as const, detail: missingGovernmentHours ? "Federal resumes should include hours worked per week for each relevant role." : "Hours-per-week evidence found." }] : []),
  ];

  const strengths = [
    !isLikelyNonResume && resumeSectionCount >= 3 ? "The document has recognizable resume sections." : "",
    detected.email && detected.phone ? "Contact details are ATS-readable." : "",
    detected.skills ? "Skills section is detectable." : "",
    metricBullets.length >= 2 ? "Resume includes measurable impact." : "",
    effectiveTargetCoverage >= 60 ? "Good target keyword alignment." : "",
    wordCount >= 350 && wordCount <= 900 ? "Resume length is in a healthy global range." : "",
    !detected.tableRisk ? "Format is likely parser-friendly." : "",
  ].filter(Boolean);

  const fixes = [
    isLikelyNonResume ? "Upload or paste an actual resume. This file looks like an academic/project chapter, not a candidate resume." : "",
    jdCopy > 0.25 ? "Remove sentences copied from the job description — rewrite them as your own achievements using the same keywords." : "",
    duplicateBulletRatio > 0.2 ? "Replace duplicated bullets with distinct achievements." : "",
    !detected.email && !detected.phone ? "Add a professional email and phone number near the top." :
    !detected.email ? "Add a professional email near the top." :
    !detected.phone ? "Add a phone number near the top." : "",
    !detected.linkedin ? "Add a current LinkedIn profile URL near the top if the profile is complete and recruiter-ready." : "",
    !detected.skills ? "Add a clear Skills section with role-specific tools and hard skills." : "",
    !detected.experience && !detected.projects ? "Add Experience, Internship, or Projects with 3-5 proof bullets." : "",
    metricBullets.length < 2 ? "Add numbers to resume bullets: volume, time saved, accuracy, revenue, users, clients, or project size." : "",
    actionBullets.length < Math.min(4, realBulletList.length || 4) ? "Start more resume bullets with strong verbs like analyzed, built, reduced, delivered, reconciled, improved." : "",
    // The page's own principle (and the Recruiter-read section) says gaps are
    // asked about, not assumed — so the fix advice must say the same thing
    // instead of flatly instructing the user to add every missing term.
    missingKeywords.length ? `Terms in the job posting your resume never mentions: ${missingKeywords.slice(0, 10).join(", ")}. If you actually have this experience, add it with evidence; if not, leave it out rather than pad.` : "",
    detected.tableRisk ? "Use a single-column layout with standard section headings before uploading to ATS systems." : "",
    detected.privacyRisk ? "Remove personal data that can trigger bias or privacy concerns." : "",
    wordCount < 250 ? "Resume is too short for most companies; add education, projects, internships, and achievements." : "",
    wordCount > 1000 ? "Resume is long; tighten older or less relevant details." : "",
    missingGovernmentHours ? "Add hours worked per week to each relevant role and verify every qualification in the announcement." : "",
  ].filter(Boolean);

  const quickWins = fixes.slice(0, 5);
  const confidence = nonEnglish ? "Low" : input.jdText && input.targetRole ? "High" : input.targetRole || input.jdText ? "Medium" : "Low";

  // The bullets an interviewer or parser would flag first: weak-phrased
  // lines plus outcome claims with no number behind them (the credibility
  // check's data). These feed the checker's per-bullet "Fix with AI" action,
  // so they stay raw bullet text, deduped, capped.
  const flaggedBullets = [...new Set([...weakBullets, ...uniqueBullets.filter((b) => !/(\d|%|\$|₹|\bfrom .+? to )/i.test(b) && claimVerbs.test(b))])]
    .filter((b) => b.length >= 20)
    .slice(0, 5);

  return {
    score,
    grade: resultGrade,
    percentile: benchmarkPercentile(score),
    confidence,
    verdict: score >= 85 ? "Ready for broad company applications." : score >= 75 ? "Competitive, with targeted improvements still available." : score >= 60 ? "Usable, but likely to miss stronger applicants." : "Needs major improvement before applying.",
    breakdown,
    checks,
    strengths: strengths.length ? strengths : isLikelyNonResume ? ["No resume strengths detected because the uploaded document does not look like a resume."] : ["The resume has enough text to analyze."],
    fixes,
    quickWins,
    missingKeywords,
    keywordGroups: [targetGroup, hardGroup, ...(requiredGroup.found.length || requiredGroup.missing.length ? [requiredGroup] : []), ...(preferredGroup.found.length || preferredGroup.missing.length ? [preferredGroup] : []), softGroup],
    flaggedBullets,
    detected,
    companyGuidance: targetCompanyGuidance,
  };
}
