// Pure resume-content -> text flattening. Lives apart from ats-extract so
// client components (SavedResumePicker consumers) can import it without
// pulling node:zlib/jszip into the browser bundle.
import type { ResumeContent } from "./types";

/** Flatten resume content the same way the renderers consume it — the baseline text. */
export function resumeSourceText(content: ResumeContent): string {
  const parts: string[] = [content.headline];
  if (content.contact) {
    parts.push([content.contact.email, content.contact.phone, content.contact.location, content.contact.linkedin, ...(content.contact.links ?? [])].filter(Boolean).join("  •  "));
  }
  parts.push(content.summary);
  parts.push(content.skills.join(" • "));
  for (const e of content.experiences) {
    parts.push([e.title, e.company, e.period].filter(Boolean).join(" — "));
    parts.push(...e.bullets);
  }
  for (const p of content.projects ?? []) parts.push(p.name, p.detail);
  for (const ed of content.education) parts.push([ed.degree, ed.school, ed.year, ed.detail].filter(Boolean).join(", "));
  if (content.certifications?.length) parts.push(content.certifications.join(" • "));
  if (content.achievements?.length) parts.push(...content.achievements);
  if (content.languages?.length) parts.push(content.languages.join(" • "));
  return parts.filter(Boolean).join("\n");
}