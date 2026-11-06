import type { ResumeContent } from "../types";
import type { PreviewData } from "@/app/build/live-preview";
import { resumeContentToFormFields } from "./from-resume-content";
import { bulletLines, parseEducation, parseProjects, splitList } from "./parse";
import { buildContactLinks, normalizeLinkedinUrl } from "../contact-links";
import { newExperience } from "@/app/build/experience-cards";

/**
 * Render a stored resume with the same component the builder previews with.
 *
 * /resumes/[id] had no way to look at the document. The only way to see what
 * you had actually generated was to download the PDF and open it — blind, and
 * for a free user that download is watermarked and forced to the basic
 * template, so it does not even show what a premium export would look like.
 * LivePreview already existed and already rendered exactly this shape; it was
 * just never reachable from the page that most needed it.
 *
 * The mapping is the same one resume-maker performs on its own form state, via
 * resumeContentToFormFields — the inverse of the parser — so the preview cannot
 * drift from what the maker and builder show for identical content.
 */
export function resumeContentToPreviewData(content: ResumeContent, name = ""): PreviewData {
  const fields = resumeContentToFormFields(content, name);
  return {
    name: fields.name,
    role: fields.headline,
    company: "",
    email: fields.email,
    phone: fields.phone,
    linkedin: fields.linkedin.trim() ? normalizeLinkedinUrl(fields.linkedin) : "",
    location: fields.location,
    // The LinkedIn URL is rendered on its own line above, so keeping it in the
    // generic link list too would print it twice.
    links: buildContactLinks(fields.linkedin, splitList(fields.links))
      .filter((link) => !/linkedin\.com\/in\//i.test(link)),
    summary: fields.summary,
    skills: splitList(fields.skills),
    experiences: fields.experiences.map((experience) => newExperience(experience)),
    education: parseEducation(fields.education),
    projects: parseProjects(fields.projects),
    certifications: bulletLines(fields.certifications),
    languages: splitList(fields.languages),
    achievements: bulletLines(fields.achievements),
  };
}
