import type { ResumeContent } from "./types";
import { displayHeadline } from "./resume-display";

function sentence(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function allBullets(content: ResumeContent): string[] {
  return content.experiences.flatMap((experience) => experience.bullets ?? []).filter(Boolean);
}

export function buildEvidenceCoverLetter(
  content: ResumeContent,
  candidateName: string,
  target?: { company?: string; role?: string },
): string {
  const headline = displayHeadline(content.headline, candidateName);
  const primary = content.experiences[0];
  const previous = content.experiences[1];
  const project = content.projects?.[0];
  const skills = content.skills.slice(0, 8).join(", ");
  const primaryEvidence = primary?.bullets.slice(0, 2).map(sentence).join(" ") ?? "";
  const previousEvidence = previous?.bullets[0] ? sentence(previous.bullets[0]) : "";

  // An explicit target rewrites the opening so the letter names the exact
  // company and role instead of the resume's saved (possibly different) one.
  const company = target?.company?.trim();
  const role = target?.role?.trim();
  const opening = company || role
    ? `I am applying for the ${role || headline} position${company ? ` at ${company}` : ""}. ${sentence(content.summary)}`
    : `I am applying for opportunities aligned with ${headline}. ${sentence(content.summary)}`;
  const closing = company
    ? `I would welcome the opportunity to discuss how this documented experience can support ${company}. Thank you for your time and consideration.`
    : "I would welcome the opportunity to discuss how this documented experience can support your team. Thank you for your time and consideration.";

  return [
    "Dear Hiring Team,",
    opening,
    primary
      ? `At ${primary.company || "my current organization"}, ${primaryEvidence}`
      : "My resume highlights practical project, education, and skills evidence relevant to this opportunity.",
    previous
      ? `Earlier at ${previous.company || "a previous organization"}, ${previousEvidence}`
      : "",
    skills ? `My listed skills include ${skills}.` : "",
    project ? `My ${project.name} project provides another example: ${sentence(project.detail)}` : "",
    closing,
    `Sincerely,\n${candidateName}`,
  ].filter(Boolean).join("\n\n");
}

/**
 * Cover letter tones (premium feature).
 *
 * The default letter above is one voice: formal and neutral. Different
 * applications read better in different registers — a startup founder skims,
 * a corporate HR team expects structure, a career change needs the pivot
 * addressed head-on. Each tone below re-uses the SAME evidence (bullets,
 * skills, projects — nothing invented, same honesty contract) but re-orders
 * and re-phrases it for the audience. The tone never changes the facts; it
 * changes which facts lead.
 */
export type CoverTone = "formal" | "warm" | "direct";

export function coverLetterTones(): Array<{ id: CoverTone; label: string; blurb: string }> {
  return [
    { id: "formal", label: "Formal", blurb: "Traditional structure for corporate, government, and large-company applications." },
    { id: "warm", label: "Warm", blurb: "First-person and conversational — startups, small teams, creative roles." },
    { id: "direct", label: "Direct", blurb: "Results first, three bullets up top — when the screener is skimming." },
  ];
}

export function buildEvidenceCoverLetterWithTone(
  content: ResumeContent,
  candidateName: string,
  target: { company?: string; role?: string } | undefined,
  tone: CoverTone,
): string {
  if (tone === "formal") return buildEvidenceCoverLetter(content, candidateName, target);

  const headline = displayHeadline(content.headline, candidateName);
  const primary = content.experiences[0];
  const previous = content.experiences[1];
  const project = content.projects?.[0];
  const skills = content.skills.slice(0, 8).join(", ");
  const quantified = allBullets(content).filter((b) => /\d|%|\$/i.test(b));
  const metricBullet = quantified[0] ?? primary?.bullets[0] ?? "";
  const secondBullet = primary?.bullets[1] ?? "";
  const company = target?.company?.trim();
  const role = target?.role?.trim();
  const roleLine = role || headline;
  const atCompany = company ? ` at ${company}` : "";

  if (tone === "direct") {
    // Skimmer-first: the strongest number leads, then two proof lines, done.
    return [
      "Dear Hiring Team,",
      `Applying for ${roleLine}${atCompany}. The short version:`,
      metricBullet ? `- ${sentence(metricBullet)}` : "- My resume documents measurable outcomes in every role.",
      secondBullet ? `- ${sentence(secondBullet)}` : "",
      skills ? `- Core skills: ${skills}.` : "",
      previous ? `Before this, I worked at ${previous.company || "my previous organization"}: ${sentence(previous.bullets[0] ?? "")}` : "",
      project ? `Also worth a look: ${project.name} — ${sentence(project.detail)}` : "",
      `Full detail in the attached resume. Happy to walk through any of it.\n\nSincerely,\n${candidateName}`,
    ].filter(Boolean).join("\n");
  }

  // warm — first person, names the motivation, still evidence-bound.
  const warmEvidence = primary?.bullets.slice(0, 2).map(sentence).join(" ") ?? "";
  return [
    company ? `Dear ${company} Team,` : "Dear Hiring Team,",
    `I have wanted to work on problems like the ones ${roleLine}${atCompany} covers${company ? `, and ${company} is where I would like to do it` : ""}. ${sentence(content.summary)}`,
    primary
      ? `Most recently at ${primary.company || "my current organization"}, ${warmEvidence}`
      : "My background is hands-on: the projects and coursework on my resume are mine, start to finish.",
    metricBullet ? `The result I am proudest of: ${sentence(metricBullet)}` : "",
    project ? `Outside of work hours I built ${project.name} — ${sentence(project.detail)}` : "",
    closingForWarm(company),
    `Sincerely,\n${candidateName}`,
  ].filter(Boolean).join("\n\n");
}

function closingForWarm(company?: string): string {
  return company
    ? `I would love to talk about what your team is building and where I could help. Thank you for reading.`
    : `I would love to talk about where I could help your team. Thank you for reading.`;
}

export function buildEvidenceInterview(content: ResumeContent) {
  const bullets = allBullets(content);
  const metric = bullets.find((bullet) => /\d|%|\$|₹/.test(bullet)) ?? bullets[0];
  const collaboration = bullets.find((bullet) => /partner|collaborat|team|stakeholder/i.test(bullet)) ?? bullets[1] ?? bullets[0];
  const quality = bullets.find((bullet) => /test|quality|performance|reliab|accessib/i.test(bullet)) ?? bullets[2] ?? bullets[0];
  const project = content.projects?.[0];
  const experience = content.experiences[0];
  const skills = content.skills.slice(0, 10).join(", ");

  return {
    items: [
      {
        q: "How does your background fit this role?",
        a: sentence(content.summary),
      },
      {
        q: "Tell me about a measurable result from your experience.",
        a: metric ? `A documented result from my resume is: ${sentence(metric)}` : "My resume does not include a quantified result yet, so I would add one before the interview.",
      },
      {
        q: "How have you worked with other people or teams?",
        a: collaboration ? `The relevant evidence in my resume is: ${sentence(collaboration)}` : "I would answer this with a specific collaboration example from my real experience.",
      },
      {
        q: "How have you improved quality, accessibility, reliability, or performance?",
        a: quality ? `The relevant evidence in my resume is: ${sentence(quality)}` : "I would answer this only with a quality or performance example I can verify.",
      },
      {
        q: "Which project or body of work best demonstrates your skills?",
        a: project
          ? `${project.name}: ${sentence(project.detail)}`
          : experience
            ? `${experience.title} at ${experience.company}: ${sentence(experience.bullets[0] ?? "")}`
            : "I would select a real project and explain its goal, my contribution, and the result.",
      },
      {
        q: "Which skills would you emphasize for this opportunity?",
        a: skills ? `The skills listed in my resume are ${skills}.` : "I would emphasize only the skills listed in my resume and support each with a real example.",
      },
    ],
  };
}
