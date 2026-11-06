import type { PreviewData } from "@/app/build/live-preview";

/** Preserve authored text, including the name, without manufacturing defaults. */
export function previewText(data: PreviewData): string {
  const parts = [data.name, data.role, data.email, data.phone, data.linkedin,
    data.location, ...data.links, data.summary, data.skills.join(", ")];
  for (const entry of data.experiences) {
    parts.push(entry.title, entry.company, entry.location, [entry.start, entry.current ? "Present" : entry.end].filter(Boolean).join(" – "), ...entry.bullets);
    if (entry.impactFacts) parts.push(...Object.values(entry.impactFacts).filter((value): value is string => typeof value === "string"));
  }
  for (const entry of data.education) parts.push(entry.degree, entry.school, entry.year || "", entry.detail || "");
  for (const entry of data.projects) parts.push(entry.name, entry.detail);
  parts.push(...data.certifications, ...data.languages, ...data.achievements);
  return parts.map((part) => part.trim()).filter(Boolean).join("\n");
}
