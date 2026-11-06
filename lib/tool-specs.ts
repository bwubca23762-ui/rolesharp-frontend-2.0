// Token-efficient tool specifications for the markdown twins at
// /tools/<slug>.md (app/tools-md/[tool]/route.ts). One entry per core free
// tool: what it does, how to use it, inputs, output shape, and the honesty
// rules the tool enforces. The interactive pages own their marketing copy;
// this is the crawler-facing spec, deliberately terse.

export type ToolSlug =
  | "ats-resume-checker"
  | "resume-fixer"
  | "resume-builder"
  | "resume-match"
  | "resume-compare"
  | "linkedin-checker"
  | "cv-converter"
  | "linkedin-headline-generator"
  | "ats-xray"
  | "github-resume"
  | "ai-humanizer";

export type ToolSpec = {
  path: string;
  title: string;
  answer: string; // one-sentence direct answer, the AEO snippet
  description: string;
  steps: string[];
  inputs: Array<{ label: string; detail: string }>;
  outputs: string[];
  limits?: string;
  related: Array<[string, string]>;
};

export const TOOL_SPECS: Record<ToolSlug, ToolSpec> = {
  "ats-resume-checker": {
    path: "/checker",
    title: "ATS Resume Checker",
    answer: "The ATS resume checker scores your resume out of 100 on parseability, keyword coverage against a job description, bullet evidence, and formatting — free, no account.",
    description:
      "Paste your resume text (or a resume and a job description together) and get a score with a prioritized fix list: missing keywords, weak bullets, and layout risks a parser can misread. Works as a resume grader, CV checker, and keyword scanner for any country's hiring norms.",
    steps: [
      "Paste or upload your resume (PDF, DOCX, or TXT up to 5 MB).",
      "Optionally paste the target job description for role-specific keyword matching.",
      "Read the score, then work the ranked fix list top-down.",
    ],
    inputs: [
      { label: "Resume text or file", detail: "PDF, DOCX, or TXT. The document is parsed in memory; files are never stored." },
      { label: "Job description (optional)", detail: "Pasting one switches keyword matching from role norms to that posting's actual requirements." },
    ],
    outputs: [
      "A 0–100 score with a plain-English grade",
      "Missing vs covered keywords, grouped by importance",
      "Per-bullet weak-bullet flags with one-click rewrite suggestions",
      "Layout and parseability risks (columns, tables, images, headers)",
    ],
    limits:
      "The score is a diagnostic estimate, not an employer decision — different ATS products parse and weight differently. Add a missing keyword only where your real experience supports it.",
    related: [
      ["Resume fixer", "/resume-fixer"],
      ["Resume match checker", "/resume-match"],
      ["AI resume builder", "/build"],
    ],
  },
  "resume-fixer": {
    path: "/resume-fixer",
    title: "Resume Fixer",
    answer: "Upload an old resume and the fixer scores it, lists the missing keywords and weak bullets, and ranks the repairs by impact — then carries the content into a rebuild.",
    description:
      "For people with an existing resume. Checks parseable structure, contact basics, skills, job keywords, bullet strength, and missing details, then shows which fixes move the score most before any rewrite.",
    steps: [
      "Upload the old resume (PDF, DOCX, or TXT).",
      "Name the target role (and country) for market-aware guidance.",
      "Fix the ranked issues, or send the extracted content into the resume maker as editable starter text.",
    ],
    inputs: [
      { label: "Old resume", detail: "Any export — even from another builder or LinkedIn — works." },
      { label: "Target role", detail: "Sets the keyword norms the score checks against." },
    ],
    outputs: [
      "A score with the top repairs ranked by impact",
      "Weak-bullet examples to rewrite first",
      "A 'Rebuild in maker' path that carries your text forward",
    ],
    related: [
      ["ATS resume checker", "/checker"],
      ["Manual resume maker", "/resume-maker"],
    ],
  },
  "resume-builder": {
    path: "/build",
    title: "AI Resume Builder",
    answer: "The AI resume builder tailors your resume to one specific company, role, and job description — then scores the result against that posting.",
    description:
      "Pick the company and role, paste the job description, add your experience. The builder rewrites the resume around that opening's language and requirements, gives an ATS score, and exports an ATS-safe PDF or DOCX.",
    steps: [
      "Pick company, role, and country.",
      "Paste the job description and add your experience bullets.",
      "Review the generated draft, check its score, and export.",
    ],
    inputs: [
      { label: "Company and role", detail: "Autocomplete against a 100,000+ employer catalog." },
      { label: "Job description", detail: "The exact posting text; the tailor works from its real requirements." },
      { label: "Your experience", detail: "The evidence the resume is built from — never invented." },
    ],
    outputs: [
      "A tailored resume draft with an ATS score",
      "A live preview with page-fit and zoom controls",
      "PDF export free (small watermark); DOCX and no watermark on Premium",
    ],
    limits:
      "Rewrites only claim what your entered experience supports. Unsupported requirements are surfaced as gaps, not written in.",
    related: [
      ["ATS resume checker", "/checker"],
      ["Cover letter generator", "/cover-letter-generator"],
      ["Job finder", "/jobs"],
    ],
  },
  "resume-match": {
    path: "/resume-match",
    title: "Resume vs Job Description Match Checker",
    answer: "Paste a resume and a job description to get a fit score out of 100, the keywords you cover, and exactly what's missing — free, no account, nothing stored.",
    description:
      "Measures how much of a posting's repeated requirements — skills, tools, phrases — your resume already evidences, weighted by importance. The same matching engine the ATS score uses.",
    steps: [
      "Paste your resume text.",
      "Paste the full job posting text.",
      "Read the score, covered keywords, and the missing list.",
    ],
    inputs: [
      { label: "Resume text", detail: "Plain text; upload on the checker first if you only have a file." },
      { label: "Job description", detail: "Include the requirements section — it carries the keywords." },
    ],
    outputs: [
      "A 0–100 match score",
      "Covered vs missing keywords",
      "Honest guidance: below 35 means a different profile, not a bad resume",
    ],
    limits:
      "Nothing is stored — the match runs in memory and is discarded on close. 75+ is excellent, 55–74 strong.",
    related: [
      ["ATS resume checker", "/checker"],
      ["Compare two resume versions", "/resume-compare"],
    ],
  },
  "resume-compare": {
    path: "/resume-compare",
    title: "Compare Two Resume Versions",
    answer: "Paste two resume versions and one job description to see which scores higher, what each covers that the other misses, and the gaps they share — free, nothing stored.",
    description:
      "For deciding between tailored variants or checking whether an edit actually helped. Both versions are analyzed in memory against the same posting and discarded.",
    steps: [
      "Paste version A and version B of your resume.",
      "Paste the job description both are aimed at.",
      "Compare scores, unique coverage, and shared gaps.",
    ],
    inputs: [
      { label: "Two resume versions", detail: "Plain text for each." },
      { label: "One job description", detail: "The common target both are measured against." },
    ],
    outputs: [
      "Per-version match scores",
      "Keywords each version covers that the other misses",
      "'Missing from both' — the shared gaps to close before submitting either",
    ],
    related: [
      ["Resume match checker", "/resume-match"],
      ["AI resume builder", "/build"],
    ],
  },
  "linkedin-checker": {
    path: "/linkedin-checker",
    title: "LinkedIn Profile Checker",
    answer: "Paste your LinkedIn profile text to score your headline, About section, experience proof, skills visibility, and target-role keywords — free, the way recruiters skim it.",
    description:
      "Scores the profile the way a recruiter's six-second skim reads it: does the headline say what you do and for whom, does the About carry proof, are the skills the ones the target role searches for.",
    steps: [
      "Copy your profile sections (headline, About, experience) as text.",
      "Paste them into the checker with your target role.",
      "Work the ranked suggestions.",
    ],
    inputs: [
      { label: "Profile text", detail: "Headline, About, and experience sections pasted as text." },
      { label: "Target role", detail: "Sets the keyword set the visibility checks use." },
    ],
    outputs: [
      "Headline and About scores with rewrite guidance",
      "Experience proof signals and recruiter keyword match",
      "Skills visibility checks",
    ],
    related: [
      ["LinkedIn headline generator", "/linkedin-headline-generator"],
      ["ATS resume checker", "/checker"],
    ],
  },
  "cv-converter": {
    path: "/cv-converter",
    title: "CV to Resume Converter",
    answer: "Paste an academic CV and get a structured conversion plan — what to remove, compress, and reframe into the one-to-two page resume format industry employers expect.",
    description:
      "For academics moving to industry. Analyses the CV's sections and produces an ordered conversion plan: which publications and teaching entries to cut or compress, what to reframe as outcomes, and what recruiters in industry expect instead.",
    steps: [
      "Paste your academic CV text.",
      "Read the conversion plan, section by section.",
      "Rebuild in the resume maker following the plan.",
    ],
    inputs: [{ label: "CV text", detail: "The full academic CV pasted as plain text." }],
    outputs: [
      "A section-by-section remove/compress/reframe plan",
      "What industry recruiters expect in place of academic conventions",
      "A path into the manual resume maker",
    ],
    related: [
      ["Manual resume maker", "/resume-maker"],
      ["Resume fixer", "/resume-fixer"],
    ],
  },
  "linkedin-headline-generator": {
    path: "/linkedin-headline-generator",
    title: "LinkedIn Headline Generator",
    answer: "Get LinkedIn headline candidates built on the formula recruiters search — role, skills, proof — matched to your target job, free.",
    description:
      "Generates headline options from your role, skills, and proof points using the structure recruiter searches and skim-reads actually reward.",
    steps: [
      "Enter your role and key skills.",
      "Add a proof point (a real result or scope).",
      "Pick a headline and paste it into LinkedIn.",
    ],
    inputs: [
      { label: "Role and skills", detail: "What you do and what you do it with." },
      { label: "Proof point", detail: "A real result or scope — never invented." },
    ],
    outputs: ["Multiple headline candidates on the role-skills-proof formula"],
    related: [
      ["LinkedIn profile checker", "/linkedin-checker"],
      ["Professional summary generator", "/resume-summary-generator"],
    ],
  },
  "ats-xray": {
    path: "/ats-xray",
    title: "ATS Parser X-Ray",
    answer: "The ATS Parser X-Ray shows line by line what an applicant tracking system actually extracts from your resume, then compares keyword frequency against the job description with a TF-IDF similarity matrix.",
    description:
      "Every line of the resume is classified into a section and checked for the four structural failures that break parser reading order — multi-column collisions, table traps, unknown headers, and detached dates — across the Workday, Greenhouse, Lever, Taleo, and iCIMS parser profiles. Optional job-description input adds the keyword frequency matrix: how many times the posting says a term versus your resume, with bullet templates for every gap.",
    steps: [
      "Paste or upload your resume text.",
      "Optionally paste the job description.",
      "Read the parser table and the keyword frequency matrix.",
    ],
    inputs: [
      { label: "Resume text", detail: "Pasted, uploaded (PDF/DOCX/TXT), a saved resume, or the active workspace draft." },
      { label: "Job description", detail: "Optional — enables the TF-IDF similarity score and frequency matrix." },
    ],
    outputs: [
      "A line-by-line table of what each ATS parser reads",
      "Section extraction status for Contact, Summary, Experience, Education, and Skills",
      "Pass/warn badges for the five vendor parser profiles",
      "A keyword frequency matrix with copyable bullet templates for missing terms",
    ],
    limits: "Everything runs deterministically in your browser — no account, no upload to a server, no model call.",
    related: [
      ["ATS resume checker", "/checker"],
      ["JD match & compare", "/resume-match"],
    ],
  },
  "github-resume": {
    path: "/github-resume",
    title: "GitHub & JSON Resume Compiler",
    answer: "The GitHub Resume Compiler turns any public GitHub profile into ATS-ready project bullets using only real repository facts, and moves your resume in and out of the open resume.json and RenderCV formats.",
    description:
      "Enter a GitHub handle and the tool reads the profile and top non-fork repositories through the GitHub REST API, aggregating languages, topics, stars, and forks into editable XYZ project bullets — numbers come from the API, never invented. The bridge panel imports any resume.json (JSON Resume or Reactive Resume) and exports to resume.json, RenderCV YAML for Git version control, or ATS plain text for the builder and checker.",
    steps: [
      "Enter a GitHub username and compile repo stats into editable bullets.",
      "Import an existing resume.json, or start from the GitHub facts.",
      "Export as resume.json, RenderCV YAML, or ATS text — or push into the builder.",
    ],
    inputs: [
      { label: "GitHub username", detail: "Any public profile — yours or a colleague's for a draft." },
      { label: "resume.json", detail: "Optional import: JSON Resume or Reactive Resume export." },
    ],
    outputs: [
      "Repository-derived project bullets with real stars, forks, and languages",
      "resume.json (v1.0.0), RenderCV YAML, and ATS plain-text exports",
      "One-click handoff into the resume maker and the AI builder",
    ],
    limits: "GitHub's public API is rate-limited per IP; the tool says so when the ceiling is hit instead of guessing.",
    related: [
      ["Manual resume maker", "/resume-maker"],
      ["ATS parser X-ray", "/ats-xray"],
    ],
  },
  "ai-humanizer": {
    path: "/ai-humanizer",
    title: "AI-Touch Remover",
    answer: "The AI-Touch Remover strips invisible watermarks, LLM cliché verbs, and robotic -ing tails from a resume in five deterministic passes, then scores how human the text reads before and after.",
    description:
      "Pass one removes zero-width spaces and non-breaking spaces that copy-paste from ChatGPT or Claude leaves behind. Pass two rewrites 45+ RLHF giveaway phrases (spearheaded, leveraged, seamlessly…) into plain practitioner verbs. Pass three trims trailing ', ensuring…' style tails — removing the fluff ones, keeping any that carries a real number. Pass four rotates repeated bullet openings for natural cadence. Pass five reports the human score, AI risk, and burstiness index with a line-by-line diff. Numbers and technical keywords are never touched.",
    steps: [
      "Paste or upload the resume text (or pull the active workspace draft).",
      "Run the de-AI pass — deterministic, instant, in-browser.",
      "Read the Bot-Stealth certificate and red/green diff, then copy or export.",
    ],
    inputs: [
      { label: "Resume text", detail: "Any text — AI-generated or hand-written. Nothing is stored." },
    ],
    outputs: [
      "Cleaned text with hidden watermarks, clichés, and robotic tails removed",
      "A Bot-Stealth verification certificate with before/after scores",
      "A line-by-line red/green diff explaining every change",
    ],
    limits: "No detector claim is absolute: the engine removes known machine fingerprints and reports what it found — it does not certify against every screening bot.",
    related: [
      ["ATS parser X-ray", "/ats-xray"],
      ["Old resume fixer", "/resume-fixer"],
    ],
  },
};

export function isToolSlug(slug: string): slug is ToolSlug {
  return slug in TOOL_SPECS;
}
