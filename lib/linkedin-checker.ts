import { terms, normalizeForMatch } from "./ats-score";

const STOP = new Set([
  "the", "and", "for", "with", "your", "from", "that", "this", "have", "will", "into", "about", "role",
  "team", "work", "using", "across", "years", "experience", "looking", "seeking", "join", "help", "build",
]);

const WEAK_HEADLINE = [
  "seeking opportunities",
  "open to work",
  "looking for opportunities",
  "fresher",
  "hardworking",
  "passionate",
];

const WEAK_ABOUT = [
  "hardworking",
  "team player",
  "quick learner",
  "results-driven professional",
  "detail-oriented",
  "passionate individual",
];

const ACTION_VERBS = [
  "built", "created", "developed", "led", "managed", "launched", "improved", "reduced", "increased",
  "delivered", "owned", "designed", "implemented", "optimized", "scaled", "automated", "analyzed",
  "reported", "reconciled", "coordinated", "drove", "supported",
];

export type LinkedinCheckInput = {
  profileText: string;
  targetRole?: string;
  targetCompany?: string;
  jdText?: string;
};

export type LinkedinCheckResult = {
  score: number;
  grade: "Excellent" | "Strong" | "Needs work" | "Weak";
  verdict: string;
  breakdown: { label: string; score: number; max: number; note: string }[];
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }[];
  fixes: string[];
  quickWins: string[];
  strengths: string[];
  missingKeywords: string[];
  detected: Record<string, boolean | number | string>;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function lines(text: string) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function sectionText(text: string, names: string[]) {
  const all = lines(text);
  const lowerNames = names.map((name) => name.toLowerCase());
  const start = all.findIndex((line) => lowerNames.includes(line.toLowerCase().replace(/:$/, "")));
  if (start < 0) return "";
  const out: string[] = [];
  for (let i = start + 1; i < all.length; i++) {
    const clean = all[i].toLowerCase().replace(/:$/, "");
    if (lowerNames.includes(clean)) continue;
    if (["about", "summary", "experience", "work experience", "education", "skills", "skills & endorsements", "top skills", "featured", "licenses & certifications", "certifications", "projects", "recommendations", "activity", "interests", "volunteering", "honors & awards"].includes(clean)) break;
    out.push(all[i]);
  }
  return out.join("\n").trim();
}

function keywordSet(text: string) {
  return [...new Set(terms(text).filter((term) => !STOP.has(term)).slice(0, 90))];
}

// Haystack must be canonicalized the same way terms() canonicalizes target
// terms — otherwise "Node.js"/"CI/CD"/"front-end" in the profile never match
// the canonical terms "nodejs"/"cicd"/"frontend" and coverage is deflated.
function keywordCoverage(targetTerms: string[], hay: string) {
  if (!targetTerms.length) return 0.65;
  const lower = normalizeForMatch(hay);
  const hits = targetTerms.filter((term) => lower.includes(term)).length;
  return hits / targetTerms.length;
}

function missingKeywords(targetTerms: string[], hay: string) {
  const lower = normalizeForMatch(hay);
  return targetTerms.filter((term) => !lower.includes(term)).slice(0, 12);
}

// Match the resume checker's expanded glyph set — Word/Canva/LinkedIn exports
// use ●▪‣–◦ etc., not just -•*.
const BULLET_MARK = /^[-•*‣▪●○◦·–—]\s*/;

function experienceBullets(text: string) {
  const out = lines(text)
    .filter((line) => BULLET_MARK.test(line) || ACTION_VERBS.some((verb) => line.toLowerCase().startsWith(verb)))
    .map((line) => line.replace(BULLET_MARK, "").trim());
  // Dedupe so a repeated bullet can't inflate experience/metric counts.
  return [...new Set(out.map((b) => b.toLowerCase()))].map((k) => out.find((b) => b.toLowerCase() === k)!);
}

function hasMetric(text: string) {
  // Outcome verbs can describe impact, but they do not make that impact
  // measurable. Only count an explicit quantity, currency, or numeric before →
  // after result as a metric.
  return /(?:\b\d+(?:[,.]\d+)*\b(?:\s*(?:%|x|k|m|million|billion))?|[$₹€£]\s*\d|\bfrom\s+\d[\d,.]*\s+\w+\s+to\s+\d[\d,.]*)/i.test(text);
}

function status(value: number, warn = 0.65): "pass" | "warn" | "fail" {
  if (value >= 0.9) return "pass";
  if (value >= warn) return "warn";
  return "fail";
}

function grade(score: number): LinkedinCheckResult["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Needs work";
  return "Weak";
}

// Verbatim JD-copy detection (same approach as the resume checker): shingle
// the JD into 10-word windows and measure how many appear word-for-word in the
// profile. High overlap = the user pasted the JD, which recruiters penalize.
function jdCopyRatio(profileText: string, jdText?: string): number {
  if (!jdText) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const jdWords = norm(jdText).split(" ").filter(Boolean);
  if (jdWords.length < 40) return 0;
  const hay = norm(profileText);
  let hits = 0, total = 0;
  for (let i = 0; i + 10 <= jdWords.length; i += 5) {
    total++;
    if (hay.includes(jdWords.slice(i, i + 10).join(" "))) hits++;
  }
  return total ? hits / total : 0;
}

export function checkLinkedinProfile(input: LinkedinCheckInput): LinkedinCheckResult {
  const text = input.profileText.slice(0, 40000).replace(/\r/g, "").trim();
  const allLines = lines(text);
  const headline = allLines.slice(0, 5).find((line) => line.length >= 12 && line.length <= 160 && !/linkedin|connections|followers/i.test(line)) || "";
  // LinkedIn exports/copies vary: "About" vs "Summary", "Skills & endorsements"
  // vs "Skills" vs "Top skills". Accept the common aliases so real profiles
  // aren't scored as missing sections they actually have.
  const about = sectionText(text, ["about", "summary"]);
  const experience = sectionText(text, ["experience", "work experience"]);
  const skills = sectionText(text, ["skills", "skills & endorsements", "top skills"]);
  const featured = sectionText(text, ["featured"]);
  const target = [input.targetRole, input.targetCompany, input.jdText].filter(Boolean).join(" ");
  const targetTerms = keywordSet(target);
  const missing = missingKeywords(targetTerms, text);
  const expBullets = experienceBullets(experience);
  const metricBullets = expBullets.filter(hasMetric);
  const firstPersonAbout = /\b(i|my|i'm|i’ve|i am)\b/i.test(about);
  const weakHeadline = WEAK_HEADLINE.some((phrase) => headline.toLowerCase().includes(phrase));
  const weakAbout = WEAK_ABOUT.filter((phrase) => about.toLowerCase().includes(phrase));
  const hasHeadline = !!headline;
  const hasAbout = about.length >= 120;
  const hasExperience = experience.length >= 80;
  const hasSkills = skills.length >= 20;
  const hasFeatured = featured.length >= 20;
  // Any meaningful term of the target role counts ("Backend Engineer" should
  // hit on "engineer" too, not only the first word).
  const roleTerms = input.targetRole ? terms(input.targetRole) : [];
  const headlineNorm = normalizeForMatch(headline);
  const headlineKeywordHit = roleTerms.some((t) => headlineNorm.includes(t));
  const keywordMatch = keywordCoverage(targetTerms, text);
  const sectionCount = [hasHeadline, hasAbout, hasExperience, hasSkills, hasFeatured].filter(Boolean).length;

  const profileStrength =
    (hasHeadline ? 5 : 0) +
    (headlineKeywordHit ? 3 : 0) +
    (!weakHeadline ? 2 : 0) +
    (hasAbout ? 6 : 0) +
    (about.length >= 220 && about.length <= 1200 ? 3 : 0) +
    (firstPersonAbout ? 2 : 0);
  const experienceStrength =
    (hasExperience ? 6 : 0) +
    Math.min(6, expBullets.length) +
    Math.min(5, metricBullets.length * 2) +
    Math.min(3, expBullets.filter((bullet) => ACTION_VERBS.some((verb) => bullet.toLowerCase().startsWith(verb))).length);
  const discoverabilityStrength =
    Math.round(keywordMatch * 12) +
    (hasSkills ? 4 : 0) +
    (hasFeatured ? 2 : 0) +
    (sectionCount >= 4 ? 2 : 0);
  const qualityStrength =
    20 -
    (weakHeadline ? 4 : 0) -
    Math.min(4, weakAbout.length) -
    (about.length > 2200 ? 3 : 0) -
    (expBullets.length > 0 && metricBullets.length === 0 ? 4 : 0);

  const breakdown = [
    { label: "Profile positioning", score: clamp(profileStrength, 0, 20), max: 20, note: "Headline clarity, About strength, and first-person positioning." },
    { label: "Experience proof", score: clamp(experienceStrength, 0, 20), max: 20, note: "Experience details, action-led bullets, and measurable wins." },
    { label: "Keyword match", score: clamp(discoverabilityStrength, 0, 20), max: 20, note: "Target-role terms, searchable skills, and profile completeness." },
    { label: "Content quality", score: clamp(qualityStrength, 0, 20), max: 20, note: "Avoids vague phrases and weak, generic copy." },
    { label: "Section coverage", score: clamp(sectionCount * 4, 0, 20), max: 20, note: "Headline, About, Experience, Skills, and Featured coverage." },
  ];
  const jdCopy = jdCopyRatio(text, input.jdText);
  const jdCopyPenalty = jdCopy > 0.5 ? 20 : jdCopy > 0.25 ? 12 : 0;
  const score = clamp(breakdown.reduce((sum, item) => sum + item.score, 0) - jdCopyPenalty);
  const resultGrade = grade(score);

  const checks: LinkedinCheckResult["checks"] = [
    { id: "headline", label: "Headline", status: hasHeadline ? (weakHeadline ? "warn" : "pass") : "fail", detail: hasHeadline ? (weakHeadline ? "Headline exists but reads generic or job-seeking instead of value-led." : "Headline is present.") : "Add a clear headline with your role and niche." },
    { id: "about", label: "About section", status: hasAbout ? status(Math.min(1, about.length / 260), 0.5) : "fail", detail: hasAbout ? `${about.length} characters in About.` : "Add an About section in first person with role focus, proof, and direction." },
    { id: "first-person", label: "About voice", status: !hasAbout ? "fail" : firstPersonAbout ? "pass" : "warn", detail: firstPersonAbout ? "About uses a personal, LinkedIn-friendly voice." : "Write the About in first person so it feels like a profile, not a resume." },
    { id: "experience", label: "Experience section", status: hasExperience ? "pass" : "fail", detail: hasExperience ? "Experience section found." : "Add experience entries with outcomes, not only titles." },
    { id: "metrics", label: "Measured impact", status: expBullets.length ? status(metricBullets.length / Math.max(1, Math.min(5, expBullets.length)), 0.35) : "fail", detail: `${metricBullets.length} experience bullets include numbers or clear impact signals.` },
    { id: "skills", label: "Skills visibility", status: hasSkills ? "pass" : "warn", detail: hasSkills ? "Skills section found." : "Add a Skills section so recruiters can find you in search." },
    { id: "featured", label: "Featured proof", status: hasFeatured ? "pass" : "warn", detail: hasFeatured ? "Featured content found." : "Add Featured links, projects, posts, or portfolio proof if you have them." },
    // Without a target role/JD there is nothing real to measure — say so
    // instead of showing a fake "65% coverage" baseline.
    { id: "keywords", label: "Target keyword match", status: targetTerms.length ? status(keywordMatch, 0.5) : "warn", detail: targetTerms.length ? `${Math.round(keywordMatch * 100)}% target keyword coverage.` : "Add a target role or paste a job description to measure keyword match." },
    ...(jdCopy > 0.25 ? [{ id: "jd-copy", label: "Copied job description", status: "fail" as const, detail: "Large parts of the job description appear verbatim in your profile. Rewrite them in your own voice using the same keywords." }] : []),
  ];

  const fixes = [
    !hasHeadline ? "Add a headline that says what you do and where you add value, not just 'Open to work' or 'Seeking opportunities'." : "",
    weakHeadline ? "Tighten the headline around your target role, specialty, tools, or industry instead of generic job-seeking language." : "",
    !hasAbout ? "Write an About section in first person covering your role, strengths, proof, and the problems you solve." : "",
    hasAbout && !firstPersonAbout ? "Rewrite the About in first person so it feels human and recruiter-friendly." : "",
    weakAbout.length ? `Remove vague LinkedIn phrases like ${weakAbout.slice(0, 3).join(", ")} and replace them with specific proof.` : "",
    !hasExperience ? "Add experience entries with what you owned, changed, or improved." : "",
    expBullets.length > 0 && metricBullets.length === 0 ? "Add numbers to experience: users served, time saved, revenue influenced, accuracy improved, or volume handled." : "",
    !hasSkills ? "Add a Skills section with the exact tools and domain terms recruiters search for." : "",
    !hasFeatured ? "Add Featured proof such as projects, portfolio, GitHub, case studies, or strong posts." : "",
    missing.length ? `Work in missing target keywords naturally: ${missing.slice(0, 8).join(", ")}.` : "",
  ].filter(Boolean);

  const strengths = [
    hasHeadline && !weakHeadline ? "Headline has a clearer professional position." : "",
    hasAbout && firstPersonAbout ? "About reads more like a real LinkedIn profile than a pasted resume." : "",
    hasExperience ? "Experience section gives recruiters something to scan quickly." : "",
    metricBullets.length >= 2 ? "Experience includes measurable proof, which makes the profile more credible." : "",
    hasSkills ? "Skills section improves recruiter search visibility." : "",
    hasFeatured ? "Featured content adds proof beyond plain text." : "",
  ].filter(Boolean);

  return {
    score,
    grade: resultGrade,
    verdict: score >= 85 ? "Strong LinkedIn profile for recruiter scans and outreach." : score >= 75 ? "Good base profile, with a few upgrades available." : score >= 60 ? "Usable, but still too generic in places." : "Needs stronger positioning before it will stand out.",
    breakdown,
    checks,
    fixes,
    quickWins: fixes.slice(0, 5),
    strengths: strengths.length ? strengths : ["The profile has enough text to analyze."],
    missingKeywords: missing,
    detected: {
      headline: hasHeadline,
      about: hasAbout,
      experience: hasExperience,
      skills: hasSkills,
      featured: hasFeatured,
      firstPersonAbout,
      weakHeadline,
      keywordCoverage: Math.round(keywordMatch * 100),
      aboutLength: about.length,
      experienceBullets: expBullets.length,
      metricBullets: metricBullets.length,
    },
  };
}
