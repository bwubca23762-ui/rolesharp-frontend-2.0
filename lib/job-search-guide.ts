/**
 * The job search guide.
 *
 * Every free "job seeker guide" is a PDF of advice nobody can check against the
 * product that handed it over. This one is assembled from the product's own
 * logic: the filler phrases it tells you to cut are the exact list the ATS
 * score penalises, the before/after bullets are run through the same
 * strengthenBullets() the free tool calls, and the letter shapes are the six
 * /cover-letter-templates renders. Change the checker and this guide changes
 * with it — which is the only way a document handed to a stranger stays true
 * once nobody is watching it.
 *
 * Same contract as the generators: it restructures and it names what is
 * missing. It does not invent a fact about the reader.
 */

import { WEAK_PHRASES } from "./resume-checker";
import { strengthenBullets, type BulletReview } from "./micro-generators";
import { COVER_LETTER_STRUCTURES } from "./cover-letter-structures";

export type GuideStep = {
  n: number;
  title: string;
  /** The principle, in one sentence. */
  rule: string;
  why: string;
  actions: string[];
  tool?: { href: string; label: string };
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    n: 1,
    title: "Score the resume you already have, before rewriting a word",
    rule: "A rewrite you start blind is a rewrite you cannot check.",
    why: "A resume usually fails on three or four specific things — no metrics, missing contact details, filler openers, keywords the posting keeps repeating. Those are findable in a minute. Rewriting from instinct means changing the parts that were already fine and keeping the parts that were not.",
    actions: [
      "Score the current version and write the number down, so the next one has something to beat.",
      "Read the breakdown before the total. The total tells you nothing about what to do next.",
      "Do not start a new document yet. Most resumes need edits, not a rebuild.",
    ],
    tool: { href: "/checker", label: "Score a resume free" },
  },
  {
    n: 2,
    title: "Fix in the order the breakdown gives you",
    rule: "Work top-down through what is missing, not through what is easiest.",
    why: "Contact details and section headings are worth points and take a minute. Rewriting every bullet takes an evening. People reliably do the evening first and then run out of patience before the minute.",
    actions: [
      "Close the flat-out gaps first: email, phone, location, a LinkedIn URL that resolves.",
      "Then the structure: real section headings, one column, no text inside images or tables.",
      "Then the writing, which is step 3 and the part that actually takes time.",
    ],
    tool: { href: "/resume-fixer", label: "See what to fix first" },
  },
  {
    n: 3,
    title: "Write every bullet as evidence: what you did, what changed, by how much",
    rule: "A bullet a reader cannot picture is a bullet they skip.",
    why: "Filler openers push the verb to the middle of the sentence and the result off the end of it. The strongest bullet you have is usually already on the page, buried behind four words of throat-clearing.",
    actions: [
      "Start with a past-tense verb. Led, Built, Cut, Reduced, Shipped.",
      "Put a number in it: how much, how many, how fast, over what period.",
      "If you cannot put a number on it, say what changed instead of how big it was. An honest qualitative result beats an invented figure you cannot defend in the room.",
    ],
    tool: { href: "/resume-bullet-points-generator", label: "Rewrite bullets free" },
  },
  {
    n: 4,
    title: "Keep one base resume; tailor a copy per application",
    rule: "One document sent everywhere is optimised for nowhere.",
    why: "Postings for the same job title ask for different things, and the words they repeat are the words the screen looks for. Tailoring is mostly reordering and renaming what is already true — not writing new claims.",
    actions: [
      "Keep a master document with everything, longer than you would ever send.",
      "Per application: cut to one or two pages, lead with the experience the posting keeps describing, and use the posting's own nouns where they are honest.",
      "Never add a skill to match a posting. The interview is where that ends.",
    ],
    tool: { href: "/build", label: "Tailor to one posting" },
  },
  {
    n: 5,
    title: "The cover letter is an argument, and the order decides it",
    rule: "Pick a shape before you pick a sentence.",
    why: "Most letters open by naming the job and expressing keen interest, which the reader already knows and does not believe. The shapes below differ in what they lead with, and that is the only variable that changes the outcome.",
    actions: [
      "Choose one shape and commit to it. Mixing two produces the letter everyone sends.",
      "Lead with the strongest thing you can defend under one follow-up question.",
      "Say less than you want to. A short letter that is entirely true reads stronger than a full page that is partly padding.",
    ],
    tool: { href: "/cover-letter-templates", label: "See the six shapes" },
  },
  {
    n: 6,
    title: "Apply narrower than feels comfortable, and follow up once",
    rule: "Twenty tailored applications beat two hundred generic ones, and take less time.",
    why: "Volume feels like progress because it produces activity. It also produces the same rejection two hundred times, with no information about why. A narrow list gives you something to learn from.",
    actions: [
      "Track every application with the date and the version you sent. Without it you cannot tell what worked.",
      "Follow up once, about a week later, in three sentences. Once is professional; twice is a decision you have made for them.",
      "Reread the posting before any conversation. You will have forgotten which version of you applied.",
    ],
    tool: { href: "/tracker", label: "Track applications" },
  },
  {
    n: 7,
    title: "The interview is the same evidence, spoken",
    rule: "Every bullet on the page is a question you have already agreed to answer.",
    why: "Interviews go wrong when the document claims more than the person can walk through. If a line survives a follow-up question, it belongs there. If it does not, it was never an asset.",
    actions: [
      "Take your three strongest bullets and say each one out loud as a situation, what you did, and what changed.",
      "For every number on your resume, know how it was measured and who else was involved.",
      "Prepare the gap question before it is asked. A short, direct answer closes it; an excuse invites a second question.",
    ],
    tool: { href: "/interview-prep", label: "Prepare answers" },
  },
];

/** Rendered live by strengthenBullets(), so the guide cannot promise a rewrite
 * the free tool does not actually perform. The third line is already good — a
 * demonstration that only ever complains is not a demonstration. */
export const BULLET_DEMO_INPUT = [
  "Responsible for managing the monthly reporting process",
  "Worked on improving the checkout flow with the design team",
  "Cut invoice processing time from 6 days to 2 days across 3 regional teams",
].join("\n");

export function bulletDemo(): BulletReview[] {
  return strengthenBullets(BULLET_DEMO_INPUT);
}

/** The phrases the score itself penalises — not a second list that can drift
 * away from it. */
export const FILLER_PHRASES: readonly string[] = WEAK_PHRASES;

export const LETTER_SHAPES = COVER_LETTER_STRUCTURES.map((s) => ({
  name: s.name,
  leadsWith: s.leadsWith,
  useWhen: s.useWhen,
}));

/** Stated in the guide itself. A document that only sells is a document the
 * reader discounts entirely, including the parts that were true. */
export const GUIDE_LIMITS = [
  "No template beats an ATS by itself. A clean one-column layout stops you losing points; it does not win any.",
  "Nothing here writes a fact about you. Every tool RoleSharp ships restructures what you typed and names what is missing, and this guide holds the same line.",
  "Keyword matching is not the whole screen. A human reads what survives it, and they are the one deciding.",
  "No number in your job search is a percentile against other candidates unless somebody measured one.",
];

export const GUIDE_TITLE = "The Job Search Guide";
export const GUIDE_SUBTITLE = "Seven steps from the resume you have to the interview you want.";
export const GUIDE_FILENAME = "rolesharp-job-search-guide.pdf";
