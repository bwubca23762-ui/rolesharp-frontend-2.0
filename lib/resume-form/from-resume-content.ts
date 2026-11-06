import type { ResumeContent } from "../types";

/**
 * Turn structured ResumeContent into the flat fields the maker and builder
 * forms hold, the inverse of lib/resume-form/parse.ts.
 *
 * Any prefill path needs this: LinkedIn import today, and an uploaded resume or
 * a saved resume opened for editing after that. Keeping it here means the
 * serialisation stays in one place and cannot drift from the parser that reads
 * it back.
 */

export type FormExperience = {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
};

export type ResumeFormFields = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  links: string;
  summary: string;
  skills: string;
  education: string;
  projects: string;
  certifications: string;
  languages: string;
  achievements: string;
  experiences: FormExperience[];
};

const CURRENT = /^(present|current|now)$/i;

/** "January 2022 - Present" becomes a start, an end, and a current flag. */
export function splitPeriod(period: string | undefined): { start: string; end: string; current: boolean } {
  const value = (period ?? "").trim();
  if (!value) return { start: "", end: "", current: false };

  const parts = value.split(/\s*[-–—]\s*/);
  if (parts.length < 2) return { start: value, end: "", current: false };

  const start = parts[0].trim();
  const end = parts.slice(1).join(" - ").trim();
  return CURRENT.test(end) ? { start, end: "", current: true } : { start, end, current: false };
}

export function resumeContentToFormFields(content: ResumeContent, name = ""): ResumeFormFields {
  return {
    name,
    headline: content.headline ?? "",
    email: content.contact?.email ?? "",
    phone: content.contact?.phone ?? "",
    linkedin: content.contact?.linkedin ?? "",
    location: content.contact?.location ?? "",
    links: (content.contact?.links ?? []).join("\n"),
    summary: content.summary ?? "",
    skills: (content.skills ?? []).join(", "),
    // parseEducation and parseProjects read these back on submit, so the
    // pipe-delimited shape here has to match exactly.
    education: (content.education ?? [])
      .map((entry) => [entry.degree, entry.school, entry.year ?? "", entry.detail ?? ""].join(" | ").replace(/(\s\|\s*)+$/, ""))
      .join("\n"),
    projects: (content.projects ?? []).map((project) => `${project.name} | ${project.detail}`).join("\n"),
    // One per line, not comma-joined: certification and language names carry
    // their own commas ("AWS Solutions Architect, Associate") and would come
    // back as two entries otherwise. splitList treats multi-line input as
    // one-per-line for this reason.
    certifications: (content.certifications ?? []).join("\n"),
    languages: (content.languages ?? []).join("\n"),
    achievements: (content.achievements ?? []).join("\n"),
    experiences: (content.experiences ?? []).map((experience) => {
      const { start, end, current } = splitPeriod(experience.period);
      return {
        title: experience.title ?? "",
        company: experience.company ?? "",
        location: "",
        start,
        end,
        current,
        // An empty bullet keeps the card's first input rendered and editable.
        bullets: experience.bullets?.length ? experience.bullets : [""],
      };
    }),
  };
}
