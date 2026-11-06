import { termPresent } from "./resume-checker";

// ── Resume ↔ Job Description match engine ──
// Shared brain for the public matcher tool (T1), version compare (T6), and
// cover-letter analyzer (T9). Deterministic only: no LLM, no network, same
// termPresent() matcher the ATS checker uses so scores can never disagree.

export type MatchVerdict = "strong" | "partial" | "missing";

export type MatchedTerm = {
  term: string;
  verdict: MatchVerdict;
  /** Where in the JD this requirement appeared (context snippet). */
  context?: string;
};

export type MatchResult = {
  /** 0–100 weighted fit score. */
  fitScore: number;
  grade: "Excellent" | "Strong" | "Fair" | "Weak";
  /** Terms found in both resume and JD. */
  matched: string[];
  /** Terms required by the JD but absent from the resume. */
  missing: string[];
  /** Verdicts per term for UI rendering (bars/rows). */
  terms: MatchedTerm[];
  /** JD-extracted hard requirements the user should verify manually (years, degrees). */
  experienceHints: string[];
  counts: {
    jdTerms: number;
    matched: number;
    missing: number;
  };
  /** Missing terms drawn from the JD's Requirements/Must-Have section (2.0x weight). */
  mustHaveMissing?: string[];
  /** Missing terms drawn from the JD's Preferred/Nice-to-Have section (0.5x weight). */
  niceToHaveMissing?: string[];
  /** Pairs where the JD term matched through a synonym alias (K8s ↔ Kubernetes). */
  synonymMatches?: Array<{ jdTerm: string; resumeTerm: string }>;
};

/**
 * Splits a JD into requirement-weight zones. Text under a
 * Requirements/Must-Have/Qualifications heading carries 2.0x; text under
 * Preferred/Nice-to-Have/Bonus carries 0.5x; everything else 1.0x.
 */
const REQUIRE_SECTION = /\b(requir(?:ements?|ements)|must[- ]have|qualifications?|basic qualifications|what you.?ll need|you have|about you)\b/i;
const PREFERRED_SECTION = /\b(preferred|nice[- ]to[- ]have|bonus(?: points| skills)?|plus(?:es)?|desirable)\b/i;

function sectionWeights(jdText: string, terms: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  const clean = jdText.slice(0, 30_000);
  const lines = clean.split("\n");
  let mode: "req" | "pref" | "neutral" = "neutral";
  // Precompile per-term regexes once.
  const matchers = terms.map((t) => ({ t, re: new RegExp(`(^|[^a-z0-9+#])${escapeRegex(t)}($|[^a-z0-9+#])`, "i") }));
  for (const line of lines) {
    const bare = line.trim();
    // Heading lines are short and often end with a colon.
    if (bare.length <= 60 && REQUIRE_SECTION.test(bare)) { mode = "req"; continue; }
    if (bare.length <= 60 && PREFERRED_SECTION.test(bare)) { mode = "pref"; continue; }
    const lower = bare.toLowerCase();
    for (const { t, re } of matchers) {
      if (!re.test(lower)) continue;
      const w = mode === "req" ? 2.0 : mode === "pref" ? 0.5 : 1.0;
      weights.set(t, Math.max(weights.get(t) ?? 0, w));
    }
  }
  return weights;
}

// ── Stop-words and noise filtering for JD keyword extraction ──

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has",
  "this", "that", "from", "they", "their", "them", "who", "all", "any", "can",
  "not", "but", "may", "also", "about", "into", "over", "after", "before",
  "while", "when", "what", "where", "how", "why", "than", "then", "more",
  "most", "some", "such", "only", "each", "other", "both", "between", "through",
  "during", "under", "above", "same", "being", "been", "were", "was", "does",
  "did", "doing", "having", "would", "could", "should", "must", "shall", "might",
  "job", "role", "position", "candidate", "candidates", "applicant", "applicants",
  "company", "team", "teams", "work", "working", "experience", "experiences",
  "year", "years", "ability", "able", "skills", "skill", "knowledge", "proficiency",
  "requirements", "responsibilities", "responsibility", "qualifications", "qualified",
  "preferred", "required", "plus", "strong", "excellent", "good", "great", "proven",
  "track", "record", "including", "include", "includes", "using", "used", "use",
  "new", "well", "best", "help", "helps", "support", "supports", "across", "within",
  "at least", "minimum", "maximum", "etc", "via", "per", "based", "looking", "seeking",
  "apply", "application", "hiring", "join", "offer", "benefits", "salary", "full",
  "part", "time", "remote", "hybrid", "onsite", "office", "day", "days", "week",
  "weeks", "month", "months",
]);

// Technical multi-word terms worth keeping as phrases even though their parts are common.
const PHRASE_HINTS = [
  // SWE / platform
  "machine learning", "data science", "software engineer", "product manager",
  "project management", "customer success", "quality assurance", "unit testing",
  "code review", "design system", "case study", "stakeholder management",
  "a/b testing", "customer support", "social media", "digital marketing",
  "content marketing", "supply chain", "human resources", "financial modeling",
  "software development", "full stack", "distributed systems", "system design",
  "microservices architecture", "continuous integration", "continuous delivery",
  "test automation", "performance optimization", "technical leadership",
  "site reliability", "infrastructure as code", "incident response",
  "pair programming", "agile ceremonies", "sprint planning", "technical debt",
  "api design", "database design", "schema design", "query optimization",
  "load balancing", "caching strategy", "message queue", "event driven",
  // AI / ML
  "deep learning", "neural network", "natural language processing",
  "computer vision", "large language model", "reinforcement learning",
  "model training", "feature engineering", "model deployment", "mlops",
  "prompt engineering", "retrieval augmented generation", "vector database",
  "recommendation engine", "predictive modeling", "time series",
  // Data
  "data engineering", "data warehouse", "data pipeline", "data governance",
  "data modeling", "business intelligence", "exploratory data analysis",
  "statistical analysis", "hypothesis testing", "causal inference",
  "etl pipeline", "real time analytics", "dashboard development",
  "data quality", "master data management",
  // Product / design
  "product roadmap", "user research", "user experience", "user interface",
  "go to market", "product launch", "roadmap prioritization", "user stories",
  "competitive analysis", "market research", "conversion rate",
  "design thinking", "interaction design", "prototyping", "usability testing",
  "accessibility standards", "wireframing", "visual design", "brand identity",
  "typography", "component library",
  // Finance / accounting
  "financial analysis", "financial planning", "variance analysis", "budget management",
  "cost reduction", "cash flow", "financial reporting", "general ledger",
  "accounts payable", "accounts receivable", "tax compliance", "audit readiness",
  "internal controls", "revenue recognition", "credit analysis", "risk assessment",
  "portfolio management", "investment analysis", "capital allocation",
  // Healthcare
  "patient care", "clinical research", "electronic health records",
  "care coordination", "clinical trials", "medical terminology",
  "patient outcomes", "utilization review", "quality improvement",
  // Ops / security
  "process improvement", "change management", "vendor management",
  "capacity planning", "supply planning", "inventory management",
  "logistics coordination", "threat modeling", "vulnerability management",
  "penetration testing", "security audit", "identity management",
  "disaster recovery", "business continuity", "access control",
  // Sales / marketing
  "account management", "lead generation", "pipeline management",
  "demand generation", "account based marketing", "sales enablement",
  "quota attainment", "territory management", "client relationships",
  "email marketing", "marketing automation", "growth marketing",
  "product marketing", "campaign management", "brand strategy",
  "customer acquisition", "customer retention", "churn reduction",
  "upsell", "cross sell", "cold outreach", "discovery calls",
  "contract negotiation", "territory planning",
];

/** Minimum occurrences in the JD before a term counts as a real requirement. */
const MIN_TERM_FREQUENCY = 2;

/**
 * Verified short domain tokens (2–7 chars) that must survive keyword
 * extraction even at a single occurrence: "sql", "aws", "dbt", "fp&a" are
 * real requirements, not noise. Before this set, the frequency+length filter
 * silently dropped most of the highest-signal keywords in the engine.
 */
export const HIGH_SIGNAL_SHORT_TERMS: ReadonlySet<string> = new Set([
  // Cloud / infra
  "aws", "gcp", "azure", "ec2", "s3", "ecs", "eks", "lambda", "cloudformation",
  "terraform", "pulumi", "ansible", "chef", "puppet", "kubernetes", "k8s",
  "docker", "linux", "unix", "nginx", "haproxy", "envoy", "istio", "helm",
  // Data / databases
  "sql", "nosql", "mysql", "psql", "postgres", "postgresql", "mongodb",
  "dynamodb", "cassandra", "redis", "kafka", "spark", "hadoop", "hive",
  "airflow", "dbt", "snowflake", "bigquery", "redshift", "databricks",
  "elasticsearch", "clickhouse", "presto", "trino", "db2", "mssql", "t-sql",
  // Languages / frameworks
  "rust", "golang", "swift", "kotlin", "scala", "ruby", "perl", "bash",
  "python", "java", "typescript", "javascript", "php", "haskell", "elixir",
  "react", "nextjs", "vuejs", "svelte", "angular", "nodejs", "deno", "bun",
  "django", "flask", "fastapi", "spring", "laravel", "rails", "express",
  "graphql", "grpc", "rest", "soap", "oauth", "oidc", "jwt", "saml", "rbac",
  // ML / AI
  "pytorch", "tensorflow", "keras", "sklearn", "xgboost", "lightgbm",
  "opencv", "pandas", "numpy", "scipy", "spacy", "huggingface", "langchain",
  "cuda", "onnx",
  // Analytics / BI
  "tableau", "looker", "powerbi", "excel", "vba", "sas", "spss", "stata",
  "matlab", "jupyter", "dax", "mdx",
  // Design
  "figma", "sketch", "zeplin", "invision", "framer", "webflow", "wcag",
  "aria", "css", "sass", "less", "tailwind",
  // PM / process
  "scrum", "kanban", "jira", "asana", "linear", "notion", "confluence",
  "trello", "okr", "okrs", "kpi", "kpis", "sla", "slo", "sli",
  // Finance / compliance
  "gaap", "ifrs", "sox", "finra", "sec", "ebitda", "fp&a", "m&a", "ar", "ap",
  "gl", "pl", "p&l", "cpi", "roi", "roe", "roa", "wacc", "irr", "npv",
  "kyc", "aml", "gdpr", "ccpa", "hipaa", "pci", "pii", "phi", "soc2",
  "iso", "cissp", "cisa", "cpa", "cfa", "frm", "ctp",
  // Security / ops tooling
  "owasp", "siem", "splunk", "datadog", "sentry", "grafana", "prometheus",
  "newrelic", "pagerduty", "opsgenie", "sumologic", "crowdstrike", "okta",
  "vault", "consul",
  // Healthcare
  "hl7", "fhir", "epic", "cerner", "gmp", "glp", "gcp-clinical", "osha",
  "icd-10", "cpt", "hipaa-5010",
  // Sales / marketing / growth
  "b2b", "b2c", "b2b2c", "saas", "paas", "iaas", "daas", "gtm", "crm",
  "erp", "cms", "hubspot", "marketo", "zendesk", "salesforce", "shopify",
  "stripe", "braintree", "klaviyo", "segment", "amplitude", "mixpanel",
  "seo", "sem", "ppc", "roas", "cac", "ltv", "arr", "mrr", "nps", "csat",
  "ctr", "cpm", "cpc", "aov", "dau", "mau", "wau",
  // HR / people
  "hris", "workday", "adp", "ats", "ehs", "lms",
  // Misc product
  "ios", "android", "macos", "windows", "api", "sdk", "cli", "ux", "ui",
  "qa", "uat", "sdlc", "poc", "mvp", "bpa", "rpa",
  // High-value short languages and abbreviations.
  "c", "r", "go", "c#", "c++", "ai", "ml", "js", "ts",
]);

/**
 * Bidirectional acronym/alias map: canonical term -> accepted aliases.
 * If the JD says "Kubernetes" and the resume says "K8s" (or the reverse),
 * the term counts as matched. Keys and alias values are normalized
 * (lowercase, punctuation-stripped the same way extractJdTerms normalizes).
 */
export const CANONICAL_SYNONYMS: Record<string, string[]> = {
  "kubernetes": ["k8s", "eks", "gke", "aks"],
  "postgresql": ["postgres", "psql"],
  "javascript": ["js", "es6", "ecmascript"],
  "typescript": ["ts"],
  "react": ["reactjs", "react.js"],
  "node.js": ["nodejs", "node"],
  "next.js": ["nextjs"],
  "vue.js": ["vuejs", "vue"],
  "ci/cd": ["continuous integration", "continuous delivery", "github actions", "gitlab ci", "jenkins pipeline"],
  "amazon web services": ["aws"],
  "google cloud platform": ["gcp", "google cloud"],
  "microsoft azure": ["azure"],
  "profit and loss": ["p&l", "pl ownership"],
  "key performance indicators": ["kpi", "kpis"],
  "objectives and key results": ["okr", "okrs"],
  "customer acquisition cost": ["cac"],
  "annual recurring revenue": ["arr"],
  "monthly recurring revenue": ["mrr"],
  "search engine optimization": ["seo"],
  "certified public accountant": ["cpa"],
  "amazon web services (aws)": ["aws"],
  " structured query language": ["sql"],
  "artificial intelligence": ["ai"],
  "machine learning": ["ml"],
  "natural language processing": ["nlp"],
  "software development life cycle": ["sdlc"],
  "user experience": ["ux"],
  "user interface": ["ui"],
  "test driven development": ["tdd"],
  "infrastructure as code": ["iac"],
};
// Reverse index: alias -> canonical, built once at module load.
const SYNONYM_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(CANONICAL_SYNONYMS)) {
    map[canonical] = canonical;
    for (const alias of aliases) map[alias] = canonical;
  }
  return map;
})();
/** Returns the canonical group a term belongs to, or null. */
export function canonicalOf(term: string): string | null {
  return SYNONYM_TO_CANONICAL[normalize(term)] ?? null;
}
/** Single occurrence is enough if the term looks technical/specific. */
function isSpecific(term: string): boolean {
  return /[0-9+#.]/.test(term) || term.length > 7;
}

function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Terms that are sentence fragments, not skills — dropped from results. */
const FRAGMENT_NOISE = new Set(["we", "are", "our", "you", "your", "will", "this", "that", "all", "and", "or", "the", "a", "an", "in", "on", "to", "of", "is", "it", "as", "at", "by", "be", "with", "for", "from", "their", "they", "them", "who", "what", "which", "other", "others", "field", "role", "position", "environment", "candidate", "candidates", "person", "someone", "us", "uk", "years", "months"]);

function isRealTerm(term: string): boolean {
  if (term.length < 3) return false;
  // Trailing punctuation = the extractor clipped a sentence boundary.
  if (/[.]$/.test(term)) return false;
  const words = term.split(" ");
  // A multi-word term where every word is noise is a fragment.
  if (words.every((w) => FRAGMENT_NOISE.has(w) || STOP_WORDS.has(w))) return false;
  // Single generic stop/fragment word.
  if (words.length === 1 && (FRAGMENT_NOISE.has(term) || STOP_WORDS.has(term))) return false;
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts candidate requirement terms from a raw job description:
 * frequent unigrams/bigrams + known phrase hints + capitalized tools.
 * Ordered by frequency then specificity — most important first.
 */
export function extractJdTerms(jdText: string, limit = 40): string[] {
  const clean = normalize(jdText.slice(0, 30_000));
  const words = clean.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map<string, number>();
  const bump = (term: string, weight = 1) => {
    freq.set(term, (freq.get(term) ?? 0) + weight);
  };

  // Unigrams
  for (const w of words) bump(w);

  // Bigrams that look like real phrases (both words content-bearing, or a hint phrase)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (PHRASE_HINTS.includes(bigram)) bump(bigram, 3); // strong boost for known phrases
  }

  // Capitalized tokens from the ORIGINAL text often = tools/technologies
  // (React, AWS, Figma...). Scan original case-preserving text.
  const caps = jdText.match(/\b[A-Z][a-zA-Z0-9+#.]{1,20}\b/g) ?? [];
  for (const cap of caps) {
    const n = normalize(cap);
    if (!STOP_WORDS.has(n) && n.length > 1) bump(n, 2);
  }

  // C and R are valid language requirements but are too short for the general
  // tokenizer. Capture only explicitly uppercase standalone occurrences.
  for (const match of jdText.matchAll(/\b(?:C|R)\b/g)) bump(match[0].toLowerCase(), 2);

  return [...freq.entries()]
    .filter(([term, count]) => {
      if (!isRealTerm(term) && !HIGH_SIGNAL_SHORT_TERMS.has(term)) return false;
      if (PHRASE_HINTS.includes(term)) return true;
      if (HIGH_SIGNAL_SHORT_TERMS.has(term)) return true;
      if (count >= MIN_TERM_FREQUENCY) return true;
      return count === 1 && isSpecific(term) && term.includes(" ") === false && term.length > 4;
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

/** Pulls explicit experience requirements ("5+ years", "bachelor's degree"). */
export function extractExperienceHints(jdText: string): string[] {
  const hints = new Set<string>();
  const patterns = [
    /\b(\d{1,2}\+?\s*(?:to\s*\d{1,2}\s*)?(?:years?|yrs?)[^.,;]{0,40})/gi,
    /\b(bachelor'?s?|master'?s?|phd|mba|degree)[^.,;]{0,50}/gi,
  ];
  for (const re of patterns) {
    for (const m of jdText.matchAll(re)) {
      const hint = m[0].trim();
      if (hint.length > 6 && hint.length < 90) hints.add(hint);
    }
  }
  return [...hints].slice(0, 6);
}

function grade(fit: number): MatchResult["grade"] {
  if (fit >= 75) return "Excellent";
  if (fit >= 55) return "Strong";
  if (fit >= 35) return "Fair";
  return "Weak";
}

/**
 * The core: how well does `resumeText` satisfy `jdText`?
 * Score model — coverage of JD requirements, weighted by term importance
 * (frequency in the JD), with a modest penalty for zero coverage of the top
 * third so one lucky hit can't carry a weak resume.
 */
export function matchResumeToJob(resumeText: string, jdText: string): MatchResult {
  const hay = resumeText.slice(0, 40_000);
  const jdTerms = extractJdTerms(jdText);

  // Recompute frequency to weight the score.
  const clean = normalize(jdText.slice(0, 30_000));
  const weight = new Map<string, number>();
  for (const term of jdTerms) {
    const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegex(term)}($|[^a-z0-9+#])`, "gi");
    weight.set(term, (clean.match(re) ?? []).length);
  }
  // Section awareness: a term listed under "Requirements" weighs double, one
  // under "Nice to have" half. Terms with no section signal keep 1.0.
  const sections = sectionWeights(jdText, jdTerms);
  const maxWeight = Math.max(1, ...weight.values());

  const matched: string[] = [];
  const missing: string[] = [];
  const mustHaveMissing: string[] = [];
  const niceToHaveMissing: string[] = [];
  const synonymMatches: Array<{ jdTerm: string; resumeTerm: string }> = [];
  const terms: MatchedTerm[] = [];
  let earned = 0;
  let possible = 0;

  for (const term of jdTerms) {
    const w = weight.get(term) ?? 1;
    const sectionW = sections.get(term) ?? 1;
    // Importance 1..3 from normalized frequency, scaled by the section weight.
    const base = Math.max(1, Math.min(3, Math.ceil((w / maxWeight) * 3)));
    const importance = Math.max(1, Math.min(3, Math.round(base * sectionW)));
    possible += importance;
    const present = termPresent(hay, term);
    if (present) {
      matched.push(term);
      earned += importance;
      terms.push({ term, verdict: "strong" });
      continue;
    }
    // Synonym rescue: the JD term is absent verbatim, but a known alias of
    // the same canonical skill appears in the resume (K8s ↔ Kubernetes).
    const canonical = canonicalOf(term);
    let synonymHit: string | null = null;
    if (canonical) {
      const candidates = new Set<string>([canonical, ...(CANONICAL_SYNONYMS[canonical] ?? [])]);
      candidates.delete(term);
      for (const candidate of candidates) {
        if (termPresent(hay, candidate)) { synonymHit = candidate; break; }
      }
    }
    if (synonymHit) {
      matched.push(term);
      earned += importance;
      synonymMatches.push({ jdTerm: term, resumeTerm: synonymHit });
      terms.push({ term, verdict: "strong", context: `matched via synonym “${synonymHit}”` });
      continue;
    }
    missing.push(term);
    terms.push({ term, verdict: "missing" });
    if (sectionW >= 2) mustHaveMissing.push(term);
    else if (sectionW <= 0.5) niceToHaveMissing.push(term);
  }

  const fitScore = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  return {
    fitScore,
    grade: grade(fitScore),
    matched,
    missing,
    terms,
    experienceHints: extractExperienceHints(jdText),
    counts: { jdTerms: jdTerms.length, matched: matched.length, missing: missing.length },
    mustHaveMissing: mustHaveMissing.length ? mustHaveMissing : undefined,
    niceToHaveMissing: niceToHaveMissing.length ? niceToHaveMissing : undefined,
    synonymMatches: synonymMatches.length ? synonymMatches : undefined,
  };
}

export type VersionDiff = {
  winner: "a" | "b" | "tie";
  delta: number;
  a: MatchResult;
  b: MatchResult;
  /** Terms B covers that A misses (and vice versa). */
  onlyA: string[];
  onlyB: string[];
};

export type MatchBreakdown = MatchResult & VersionDiff;

/** Compare two resume versions against one JD: winner, delta, unique coverage. */
export function compareResumes(resumeA: string, resumeB: string, jdText: string): VersionDiff {
  const a = matchResumeToJob(resumeA, jdText);
  const b = matchResumeToJob(resumeB, jdText);
  const delta = b.fitScore - a.fitScore;
  const aSet = new Set(a.matched);
  const bSet = new Set(b.matched);
  return {
    winner: delta > 0 ? "b" : delta < 0 ? "a" : "tie",
    delta: Math.abs(delta),
    a,
    b,
    onlyA: a.matched.filter((t) => !bSet.has(t)),
    onlyB: b.matched.filter((t) => !aSet.has(t)),
  };
}
