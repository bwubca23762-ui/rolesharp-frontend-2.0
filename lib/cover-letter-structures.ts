/**
 * Cover letter structures.
 *
 * Every competitor's "cover letter templates" page is a set of documents with
 * different fonts and the same hollow paragraph in each: "I am writing to
 * express my keen interest in the Senior Analyst position." The font is not the
 * variable that decides anything. The order of the argument is.
 *
 * So a structure here is an argument shape — what the letter leads with, what
 * it proves next, what it deliberately leaves out — and every sample on the
 * gallery page is rendered from ONE set of facts by these functions. Same
 * candidate, same evidence, six letters. That is a demonstration a static page
 * of pretty PDFs cannot make, and it cannot drift away from what the product
 * does, because the product renders it.
 */

export type LetterEvidence = {
  name: string;
  role: string;
  company: string;
  targetRole: string;
  targetCompany: string;
  /** Strongest first. Each must be something the candidate can defend. */
  results: string[];
  skills: string[];
  /** Only for the referral structure; nothing invents one. */
  referrer?: string;
  /** Only for the career-change structure. */
  previousField?: string;
};

export type LetterStructure = {
  slug: string;
  name: string;
  leadsWith: string;
  useWhen: string;
  /** The honesty constraint this shape is most likely to be pushed past. */
  neverDo: string;
  render: (evidence: LetterEvidence) => string;
};

function paragraphs(...parts: (string | number | false | undefined)[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function list(values: string[], limit = 3): string {
  const kept = values.slice(0, limit);
  if (kept.length <= 1) return kept[0] ?? "";
  return `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`;
}

/** "Analyst" -> "an Analyst". Job titles are kept in the case the user typed
 * them: lowercasing only the first letter produced "a senior Data Analyst",
 * and lowercasing the whole title mangles ones like "SQL Developer". The
 * vowel rule is wrong for a handful of words ("a university"), but not for job
 * titles, which is all this is ever handed. */
function withArticle(value: string): string {
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value}`;
}

const closing = (name: string) => `I would welcome a conversation about the role.\n\nSincerely,\n${name}`;

export const COVER_LETTER_STRUCTURES: LetterStructure[] = [
  {
    slug: "direct",
    name: "Direct",
    leadsWith: "The single strongest result, in the first sentence.",
    useWhen: "You have one number that is obviously relevant, and the reader is busy. This is the default, and it is right more often than people expect.",
    neverDo: "Lead with a result you cannot walk through in an interview. The whole shape depends on the first line surviving one follow-up question.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      `${e.results[0]} I am applying for the ${e.targetRole} role, and that is the work I would bring to it.`,
      e.results[1] && `At ${e.company} I work as ${withArticle(e.role)}. ${e.results[1]}`,
      e.skills.length > 0 && `Day to day I work with ${list(e.skills, 4)}.`,
      closing(e.name),
    ),
  },
  {
    slug: "problem-first",
    name: "Problem first",
    leadsWith: "The problem the posting is describing, named in your own words.",
    useWhen: "The posting is unusually specific about something painful. Naming it proves you read past the job title.",
    neverDo: "Guess at a problem the posting does not describe. A confident diagnosis of a company you have never worked at reads as arrogance, and it is usually wrong.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      `The ${e.targetRole} posting describes work I have been doing for the last few years, so I will be specific about the part I think matters most.`,
      `${e.results[0]}`,
      e.results[1] && `${e.results[1]} Both of those came out of the same job at ${e.company}.`,
      closing(e.name),
    ),
  },
  {
    slug: "referral",
    name: "Referral",
    leadsWith: "The name of the person who told you to apply.",
    useWhen: "Someone inside the company suggested you apply. This is the highest-converting opening there is, and it is only available honestly.",
    neverDo: "Name someone who did not actually refer you, or stretch \"we met once\" into a referral. It takes one message inside the company to check, and they will.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      e.referrer
        ? `${e.referrer} suggested I apply for the ${e.targetRole} role.`
        : `[Name] suggested I apply for the ${e.targetRole} role. This structure only works with a real name here — leave it out entirely rather than inventing one.`,
      `${e.results[0]}`,
      e.results[1] && `${e.results[1]}`,
      closing(e.name),
    ),
  },
  {
    slug: "career-change",
    name: "Career change",
    leadsWith: "The change itself, stated plainly, before anyone has to work it out.",
    useWhen: "Your last title does not match the one you are applying for. Saying so first stops the reader spending their attention on the puzzle instead of the evidence.",
    neverDo: "Apologise for the change, or pad the letter with transferable-skills language. Name the change in one sentence, then spend the rest on evidence.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      e.previousField
        ? `I am moving from ${e.previousField} into ${e.targetRole} work, and I would rather say that up front than have you work it out from my dates.`
        : `I am changing fields, and I would rather say that up front than have you work it out from my dates.`,
      `The overlap is not theoretical. ${e.results[0]}`,
      e.results[1] && `${e.results[1]}`,
      e.skills.length > 0 && `The tools carry over directly: ${list(e.skills, 4)}.`,
      closing(e.name),
    ),
  },
  {
    slug: "short",
    name: "Short",
    leadsWith: "Nothing. Four sentences, then your name.",
    useWhen: "The application form has a small box, or the company has said the letter is optional. A short letter that is entirely evidence beats a long one that is mostly throat-clearing.",
    neverDo: "Cut the number to make it shorter. The result is the only sentence in a short letter that is doing any work.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      `I am applying for the ${e.targetRole} role. ${e.results[0]}`,
      closing(e.name),
    ),
  },
  {
    slug: "speculative",
    name: "Speculative",
    leadsWith: "What you would work on, since there is no posting to answer.",
    useWhen: "There is no open role. You are asking someone to create a reason to talk to you, so the letter has to supply that reason itself.",
    neverDo: "Claim to know the company's priorities. You are guessing, and the honest version of this letter says so — a guess offered as a guess is a conversation, a guess offered as a fact is a red flag.",
    render: (e) => paragraphs(
      `Dear Hiring Team at ${e.targetCompany},`,
      `I am not applying to a posting — I do not think there is one open. I am writing because ${e.targetRole} work is what I do, and I would rather ask than wait.`,
      `${e.results[0]}`,
      e.results[1] && `${e.results[1]} That is at ${e.company}, where I am ${withArticle(e.role)}.`,
      `If nothing is open, I would still value knowing what you look for when something is.\n\nSincerely,\n${e.name}`,
    ),
  },
];

/** The one evidence set every sample on the gallery is rendered from. */
export const SAMPLE_EVIDENCE: LetterEvidence = {
  name: "Priya Raman",
  role: "Senior Data Analyst",
  company: "Fictional Payments",
  targetRole: "Analytics Lead",
  targetCompany: "Ledgerline",
  results: [
    "I cut monthly reconciliation from six days to two across fourteen merchant accounts.",
    "I rebuilt the settlement report and reduced manual corrections by 40%.",
    "I built the churn model the retention team now works from.",
  ],
  skills: ["SQL", "Python", "Tableau", "dbt"],
  referrer: "Anita Desai on your data team",
  previousField: "audit",
};

export function structureBySlug(slug: string): LetterStructure | undefined {
  return COVER_LETTER_STRUCTURES.find((structure) => structure.slug === slug);
}
