import { ResumeContent, type GenerateRequest, type ResumeContent as RC } from "../types";
import { humanizeResumeContent } from "../ai-humanizer";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" | ");
  if (value && typeof value === "object") {
    return Object.values(value).map(text).filter(Boolean).join(" | ");
  }
  return "";
}

function textList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(textList).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(textList).filter(Boolean);
  }
  const clean = text(value);
  return clean ? [clean] : [];
}

function objectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(record).filter((item) => Object.keys(item).length > 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).map(record).filter((item) => Object.keys(item).length > 0);
  }
  return [];
}

export function normalizeGeneratedContent(raw: unknown, req: GenerateRequest): unknown {
  const value = record(raw);
  const profile = req.profile;
  const experiences = objectList(value.experiences ?? value.experience).map((item, index) => {
    const source = profile.experiences[index];
    return {
      title: text(item.title ?? item.role ?? item.position) || source?.title || "Experience",
      company: text(item.company ?? item.employer ?? item.organization) || source?.company || "",
      period: text(item.period ?? item.duration ?? item.dates)
        || [source?.start, source?.end].filter(Boolean).join(" - ")
        || undefined,
      bullets: textList(item.bullets ?? item.responsibilities ?? item.achievements ?? item.description),
    };
  });
  const education = objectList(value.education).map((item, index) => {
    const source = profile.education[index];
    return {
      degree: text(item.degree ?? item.qualification) || source?.degree || "Education",
      school: text(item.school ?? item.institution ?? item.university) || source?.school || "",
      year: text(item.year ?? item.period ?? item.dates) || source?.year || undefined,
      detail: text(item.detail ?? item.description ?? item.field) || source?.detail || undefined,
    };
  });
  const projects = objectList(value.projects).map((item, index) => {
    const source = profile.projects[index];
    return {
      name: text(item.name ?? item.title) || source?.name || "Project",
      detail: text(item.detail ?? item.description ?? item.bullets) || source?.detail || "",
    };
  });

  return {
    headline: text(value.headline ?? value.title) || req.roleTitleRaw || profile.name,
    summary: text(value.summary ?? value.professionalSummary ?? value.profile) || profile.summary || "",
    skills: textList(value.skills).length ? textList(value.skills) : profile.skills,
    experiences: experiences.length ? experiences : profile.experiences.map((item) => ({
      title: item.title,
      company: item.company,
      period: [item.start, item.end].filter(Boolean).join(" - ") || undefined,
      bullets: item.bullets,
    })),
    education: education.length ? education : profile.education,
    projects: projects.length ? projects : profile.projects,
    certifications: textList(value.certifications).length ? textList(value.certifications) : profile.certifications,
    languages: textList(value.languages).length ? textList(value.languages) : profile.languages,
    achievements: textList(value.achievements).length ? textList(value.achievements) : profile.achievements,
  };
}

export function parseGeneratedContent(raw: unknown, req: GenerateRequest): RC {
  // The deterministic de-AI pass runs on every generated resume before it is
  // scored or saved: the builder never ships output its own Bot-Stealth
  // detector would flag (watermarks, LLM cliché verbs, robotic tails).
  return humanizeResumeContent(ResumeContent.parse(normalizeGeneratedContent(raw, req))).content;
}
