// ── Interview Question Bank (T3, TOOLS-TRACKER) ──
// Deterministic question generation from the roles taxonomy. Each skill gets
// a behavioral + technical question frame; seniority tunes the framing.
// Free tier of interview prep: role-based, not resume-bound (the premium
// resume-grounded version stays at /interview-prep).

import { getRoleBySlug } from "./db/roles";

export type BankQuestion = {
  category: "behavioral" | "technical" | "situational";
  question: string;
  /** What a strong answer demonstrates — guidance, not an answer key. */
  lookingFor: string;
};

const BEHAVIORAL_FRAMES = [
  { q: (skill: string) => `Tell me about a time you used ${skill} to solve a real problem. What was the outcome?`, look: (skill: string) => `A specific situation, your actions with ${skill}, and a measurable result.` },
  { q: (skill: string) => `Describe the most complex project where ${skill} was essential. What made it complex?`, look: (skill: string) => `Scope, constraints you navigated, and why ${skill} mattered to the outcome.` },
];

const TECHNICAL_FRAMES = [
  { q: (skill: string) => `Walk me through how you approach ${skill}. What steps do you follow and why?`, look: (skill: string) => `A structured process, not just tool names — they want to see you understand ${skill}, not just list it.` },
  { q: (skill: string) => `What are common mistakes people make with ${skill}, and how do you avoid them?`, look: () => `Real awareness of pitfalls — this separates practitioners from list-builders.` },
];

const SITUATIONAL_FRAMES = [
  { q: (skill: string, title: string) => `Imagine you join our team as ${titleArticle(title)} and your first task requires ${skill}, but you're not yet familiar with our setup. How do you proceed?`, look: () => `How you learn fast, ask good questions, and still deliver — without pretending to know things you don't.` },
];

function titleArticle(title: string): string {
  return /^(a|e|i|o|u)/i.test(title) ? `an ${title}` : `a ${title}`;
}

export type RoleBank = {
  roleSlug: string;
  roleTitle: string;
  questions: BankQuestion[];
};

export async function buildQuestionBank(roleSlug: string): Promise<RoleBank | null> {
  const role = await getRoleBySlug(roleSlug);
  if (!role) return null;

  const required = (role.required_skills ?? []).slice(0, 6);
  const preferred = (role.preferred_skills ?? []).slice(0, 3);
  const questions: BankQuestion[] = [];
  let bi = 0;
  let ti = 0;
  let si = 0;

  // Required skills alternate through categories so the bank is balanced.
  for (const skill of required) {
    const frame = bi < BEHAVIORAL_FRAMES.length ? BEHAVIORAL_FRAMES[bi % BEHAVIORAL_FRAMES.length] : null;
    if (frame && questions.filter((q) => q.category === "behavioral").length < 3) {
      questions.push({ category: "behavioral", question: frame.q(skill), lookingFor: frame.look(skill) });
      bi++;
      continue;
    }
    const tframe = TECHNICAL_FRAMES[ti % TECHNICAL_FRAMES.length];
    questions.push({ category: "technical", question: tframe.q(skill), lookingFor: tframe.look(skill) });
    ti++;
  }

  for (const skill of preferred) {
    if (questions.length >= 12) break;
    const sframe = SITUATIONAL_FRAMES[si % SITUATIONAL_FRAMES.length];
    questions.push({ category: "situational", question: sframe.q(skill, role.title), lookingFor: sframe.look() });
    si++;
  }

  return { roleSlug: role.slug, roleTitle: role.title, questions };
}

/** Slugs that have enough skills for a meaningful bank (for SEO listing). */
export async function bankEligibleRoles(limit = 50): Promise<Array<{ slug: string; title: string }>> {
  const rows = await import("./db").then((db) =>
    db.q<{ slug: string; title: string }>(
      `select slug, title from roles
       where array_length(required_skills, 1) >= 4
       order by sector, title limit $1`,
      [limit],
    ),
  );
  return rows;
}
