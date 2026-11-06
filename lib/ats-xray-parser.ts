// ATS Parser X-Ray — the OpenResume-style line-by-line inspector plus the
// Resume-Matcher-style TF-IDF keyword frequency and cosine-similarity matrix.
//
// The inspector answers the question users actually have when an ATS rejects
// them: "what did the machine READ?" Every line of the resume is classified
// into a section, and the reading order is checked for the four structural
// failures real parser exports hit — multi-column collisions, table traps,
// unknown section headers, and dates detached from their roles.
//
// The frequency matrix answers the second question: "how often does the
// posting say each keyword versus my resume?" TF-IDF cosine similarity gives
// the overall distance between the two documents; the per-term counts give
// the exact line a human can act on. Both are deterministic — same inputs,
// same table, every run. Nothing is invented: a keyword the resume does not
// evidence stays a stated gap.

import { evaluateAtsVendorCompatibility, terms } from "./ats-score";

export type ParsedResumeSection =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "achievements"
  | "references"
  | "header"
  | "other";

export type ReadingOrderStatus =
  | "clean"
  | "multi_column_collision"
  | "table_trap"
  | "unparsed_header"
  | "date_warning";

export type ParsedResumeLine = {
  lineNumber: number;
  detectedSection: ParsedResumeSection;
  extractedText: string;
  readingOrderStatus: ReadingOrderStatus;
  parserNote: string;
};

export type FrequencyCategory = "must_have" | "technical" | "domain";
export type FrequencyStatus = "matched" | "under_indexed" | "missing";

export type FrequencyRow = {
  term: string;
  category: FrequencyCategory;
  jdFrequencyCount: number;
  resumeFrequencyCount: number;
  status: FrequencyStatus;
  suggestedBulletTemplate?: string;
};

export type AtsXraySectionSummary = {
  section: "Contact" | "Summary" | "Experience" | "Education" | "Skills";
  found: boolean;
  lineCount: number;
  firstLine: string | null;
};

export type AtsXrayReport = {
  lines: ParsedResumeLine[];
  sections: AtsXraySectionSummary[];
  vendors: ReturnType<typeof evaluateAtsVendorCompatibility>;
  similarity: { score: number } | null;
  matrix: FrequencyRow[];
  stats: {
    resumeWords: number;
    jdWords: number;
    matched: number;
    underIndexed: number;
    missing: number;
    collisions: number;
  };
};

// ── section headers (the vocabulary the five vendors all index) ──────────────

const SECTION_PATTERNS: Array<[RegExp, ParsedResumeSection]> = [
  [/^\s*(?:work|professional|employment|career)\s*(?:experience|history)?\s*$/i, "experience"],
  [/^\s*experience\s*$/i, "experience"],
  [/^\s*(?:work|professional|employment)\s+(?:experience|history)\b/i, "experience"],
  [/^\s*(?:rele?vant\s+)?experience\b/i, "experience"],
  [/^\s*education(?:\s*&\s*training)?\s*$/i, "education"],
  [/^\s*education\b/i, "education"],
  [/^\s*(?:technical\s+|core\s+|key\s+|professional\s+)?skills?(?:\s*(?:&|and)\s*(?:tools|technologies|abilities))?\s*$/i, "skills"],
  [/^\s*(?:professional\s+)?(?:summary|profile|objective|about\s+me|overview)\s*$/i, "summary"],
  [/^\s*summary\b/i, "summary"],
  [/^\s*projects?(?:\s*&?\s*portfolio)?\s*$/i, "projects"],
  [/^\s*projects\b/i, "projects"],
  [/^\s*(?:certifications?|certificates|licenses?|credentials)\s*$/i, "certifications"],
  [/^\s*(?:languages?|technical\s+languages)\s*$/i, "languages"],
  [/^\s*(?:achievements?|awards?|honors?|accomplishments?)\s*$/i, "achievements"],
  [/^\s*(?:references?|publication?s?)\s*$/i, "references"],
  [/^\s*(?:interests?|activities|volunteer(?:ing)?(?:\s+experience)?)\s*$/i, "other"],
];

const CONTACT_RE = /@|\+?\d[\d\s().-]{7,}\d/;
const DATE_RANGE_RE = /\b(?:19|20)\d{2}\s*[-–—to]{1,3}\s*(?:(?:19|20)\d{2}|present|current|now)\b/i;
// A line that is ONLY a date — "June 2020", "2020", "2019 - 2021" — is a
// date detached from any role text: in two-column exports this is the
// right-hand column arriving without its left-hand anchor.
const BARE_DATE_RE =
  /^\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}(?:\s*(?:[-–—to]{1,3}|to)\s*(?:(?:19|20)\d{2}|present|current|now))?\s*\.?\s*$/i;

function detectHeader(line: string): ParsedResumeSection | null {
  for (const [pattern, section] of SECTION_PATTERNS) {
    if (pattern.test(line)) return section;
  }
  return null;
}

function looksLikeUnknownHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 42) return false;
  const words = trimmed.split(/\s+/);
  return words.length >= 1 && words.length <= 4 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

// ── the inspector ────────────────────────────────────────────────────────────

export function parseResumeLines(text: string): ParsedResumeLine[] {
  const rawLines = text.split(/\r?\n/);
  const out: ParsedResumeLine[] = [];
  let current: ParsedResumeSection = "contact";
  let sawFirstHeader = false;
  let lineNumberOfNonEmpty = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (!raw.trim()) {
      continue;
    }
    lineNumberOfNonEmpty += 1;
    let status: ReadingOrderStatus = "clean";
    let note = "";
    let section = current;

    const header = detectHeader(raw);
    if (header) {
      section = header;
      current = header;
      sawFirstHeader = true;
      note = `Section header recognized: ${header}. Every parser in the test set indexes this section.`;
    } else if (looksLikeUnknownHeader(raw) && !sawFirstHeader) {
      // ALL-CAPS name at the very top of the resume is the candidate name,
      // not an unknown header — every vendor reads it as the document root.
      section = "contact";
      note = "Candidate name / contact block at the top of the document.";
    } else if (looksLikeUnknownHeader(raw)) {
      section = "header";
      status = "unparsed_header";
      note = `Unknown section heading "${raw.trim()}" — ATS parsers index it as loose body text, so anything under it may land in the wrong section.`;
    } else if (BARE_DATE_RE.test(raw)) {
      status = "date_warning";
      note = "A date range on its own line — in a two-column export the date detaches from its role and can attach to the wrong entry.";
    } else if ((raw.match(/\|/g) ?? []).length >= 2 || /\t/.test(raw)) {
      status = "table_trap";
      note = "Table row — ATS parsers read columns as one run-on line. The right-hand column may be concatenated into the left.";
    } else if ((raw.match(/\s{3,}/g) ?? []).length >= 2) {
      status = "table_trap";
      note = "Wide spacing suggests laid-out columns; parsers concatenate them into one line.";
    } else if (raw.includes("•") && (raw.match(/•/g) ?? []).length >= 3 && !CONTACT_RE.test(raw) && !DATE_RANGE_RE.test(raw)) {
      status = "table_trap";
      note = "Multiple inline bullets on one line — a skills table. Parsers read it as one unparsed string.";
    } else if ((raw.match(DATE_RANGE_RE) ?? []).length >= 2) {
      status = "multi_column_collision";
      note = "Two date ranges on one line — left and right columns have collided in the text layer.";
    } else if (DATE_RANGE_RE.test(raw) && raw.split(/\s+/).length >= 6) {
      status = "multi_column_collision";
      note = "Date range merged with role prose on one line — classic two-column export collision.";
    } else if (!sawFirstHeader && lineNumberOfNonEmpty <= 4) {
      section = "contact";
      note = CONTACT_RE.test(raw)
        ? "Contact details read as selectable text — the parser can extract them."
        : "Top-of-document line read as part of the contact block.";
    }

    out.push({
      lineNumber: i + 1,
      detectedSection: section,
      extractedText: raw.trim().slice(0, 400),
      readingOrderStatus: status,
      parserNote: note,
    });
  }
  return out;
}

// ── TF-IDF cosine similarity & the frequency matrix ──────────────────────────
// Tokenisation reuses the scoring engine's normaliser (terms()) so the X-Ray
// and the /checker score can never disagree about what counts as a keyword.

const TECH_TERMS = new Set([
  "kubernetes", "docker", "terraform", "ansible", "jenkins", "cicd", "linux", "git",
  "github", "aws", "azure", "gcp", "javascript", "typescript", "react", "vue",
  "nextjs", "nodejs", "python", "java", "sql", "postgresql", "mysql", "mongodb",
  "redis", "kafka", "spark", "airflow", "etl", "pandas", "numpy", "tensorflow",
  "pytorch", "graphql", "rest", "api", "microservices", "agile", "scrum", "jira",
  "salesforce", "sap", "excel", "tableau", "powerbi", "looker", "figma", "css",
  "html", "tailwind", "selenium", "cypress", "jest", "vitest", "pytest", "r",
  "go", "rust", "scala", "swift", "kotlin", "flutter", "react", "security",
  "compliance", "reporting", "dashboard", "automation", "testing", "firebase",
  "lambda", "ec2", "s3", "ecr", "helm", "nginx", "django", "flask", "spring",
]);

const MUST_HAVE_LINE_RE = /requirement|qualification|must\s+have|you\s+will\s+need|we\s+require|minimum\s+of|essential/i;

function tokenCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of terms(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function tfidfCosineSimilarity(resumeText: string, jdText: string): number {
  const a = tokenCounts(resumeText);
  const b = tokenCounts(jdText);
  if (!a.size || !b.size) return 0;
  const totalA = [...a.values()].reduce((x, y) => x + y, 0);
  const totalB = [...b.values()].reduce((x, y) => x + y, 0);
  const docFreq = new Map<string, number>();
  for (const term of new Set([...a.keys(), ...b.keys()])) {
    docFreq.set(term, (a.has(term) ? 1 : 0) + (b.has(term) ? 1 : 0));
  }
  const idf = (term: string) => Math.log((2 + 1) / ((docFreq.get(term) ?? 0) + 1)) + 1;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, count] of a) {
    const weight = (count / totalA) * idf(term);
    normA += weight * weight;
  }
  for (const [term, count] of b) {
    const weight = (count / totalB) * idf(term);
    normB += weight * weight;
  }
  for (const [term, count] of a) {
    if (b.has(term)) {
      dot += (count / totalA) * idf(term) * ((b.get(term) ?? 0) / totalB) * idf(term);
    }
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.round((dot / Math.sqrt(normA * normB)) * 1000) / 10;
}

export function buildFrequencyMatrix(resumeText: string, jdText: string): FrequencyRow[] {
  const jdCounts = tokenCounts(jdText);
  const resumeCounts = tokenCounts(resumeText);
  const jdLines = jdText.split(/\r?\n/);
  const mustHaveTerms = new Set<string>();
  for (const line of jdLines) {
    if (MUST_HAVE_LINE_RE.test(line)) {
      for (const term of terms(line)) mustHaveTerms.add(term);
    }
  }

  const ranked = [...jdCounts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  return ranked.slice(0, 40).map(([term, jdFrequencyCount]) => {
    const resumeFrequencyCount = resumeCounts.get(term) ?? 0;
    const category: FrequencyCategory = jdFrequencyCount >= 3 || mustHaveTerms.has(term)
      ? "must_have"
      : TECH_TERMS.has(term)
        ? "technical"
        : "domain";
    const status: FrequencyStatus =
      resumeFrequencyCount >= jdFrequencyCount ? "matched" : resumeFrequencyCount > 0 ? "under_indexed" : "missing";
    return {
      term,
      category,
      jdFrequencyCount,
      resumeFrequencyCount,
      status,
      suggestedBulletTemplate:
        status === "missing"
          ? `Used ${term} to [what you actually changed], [X%] [measured outcome] — replace the slot with your real number.`
          : status === "under_indexed"
            ? `Named ${term} in a second bullet about a different result, [X%] [measured outcome].`
            : undefined,
    };
  });
}

// ── the combined report ──────────────────────────────────────────────────────

export function analyzeAtsXrayAndFrequency(resumeText: string, jdText?: string): AtsXrayReport {
  const lines = parseResumeLines(resumeText);
  const collisions = lines.filter(
    (l) => l.readingOrderStatus === "multi_column_collision" || l.readingOrderStatus === "table_trap",
  ).length;

  const vendors = evaluateAtsVendorCompatibility(resumeText, {
    tables: lines.some((l) => l.readingOrderStatus === "table_trap"),
    columns: collisions > 0,
  });

  const sectionSummary: AtsXraySectionSummary[] = (
    [
      ["Contact", "contact"],
      ["Summary", "summary"],
      ["Experience", "experience"],
      ["Education", "education"],
      ["Skills", "skills"],
    ] as const
  ).map(([label, key]) => {
    const rows = lines.filter((l) => l.detectedSection === key);
    return {
      section: label,
      found: rows.length > 0,
      lineCount: rows.length,
      firstLine: rows[0]?.extractedText ?? null,
    };
  });

  const matrix = jdText && jdText.trim().length > 20 ? buildFrequencyMatrix(resumeText, jdText) : [];
  const similarity = jdText && jdText.trim().length > 20 ? { score: tfidfCosineSimilarity(resumeText, jdText) } : null;

  return {
    lines,
    sections: sectionSummary,
    vendors,
    similarity,
    matrix,
    stats: {
      resumeWords: (resumeText.trim().match(/[A-Za-z0-9][A-Za-z0-9+#.%$'-]*/g) ?? []).length,
      jdWords: jdText ? (jdText.trim().match(/[A-Za-z0-9][A-Za-z0-9+#.%$'-]*/g) ?? []).length : 0,
      matched: matrix.filter((r) => r.status === "matched").length,
      underIndexed: matrix.filter((r) => r.status === "under_indexed").length,
      missing: matrix.filter((r) => r.status === "missing").length,
      collisions,
    },
  };
}
