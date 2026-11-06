// Universal resume.json & RenderCV bridge. RoleSharp's structured resume can
// move in and out of the two open standards software engineers actually use:
//
//   • JSON Resume (jsonresume.org) — the `resume.json` v1.0.0 schema, also the
//     shape Reactive Resume exports, so a user leaving either tool lands here
//     without retyping, and a RoleSharp resume can be piped into any of the
//     dozens of themes in that ecosystem.
//   • RenderCV — YAML you commit to a Git repo and version-control like code.
//
// Mapping is honest and lossy-on-the-edges: fields the target schema has no
// slot for are dropped with a warning rather than silently mangled, and every
// date that survives keeps the precision the source had — a resume that said
// "2020" never gains a fabricated month on the way out.

import { ResumeContent, type ResumeContent as RC } from "./types";
import { resumeSourceText } from "./resume-source-text";

// ── tolerant JSON readers (same pattern as lib/tailor/normalization) ─────────

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" | ");
  if (value && typeof value === "object") return Object.values(value).map(text).filter(Boolean).join(" | ");
  return "";
}

function textList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(textList).filter(Boolean);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Reactive Resume items sometimes nest the strings one level deep
    // ({ items: ["a"] } or { name: "a", description: "b" }).
    const nested = Object.values(obj).map(textList).flat();
    return nested.length ? nested : [text(obj)].filter(Boolean);
  }
  const clean = text(value);
  return clean ? [clean] : [];
}

/** Lists whose items are objects (work entries, education, …), not strings. */
function objectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(record);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.map(record);
    return Object.values(obj).map(record);
  }
  return [];
}

function first<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (value != null && value !== "") return value as T;
  }
  return undefined;
}

function clip(value: string, max: number, warnings: string[], label: string): string {
  if (value.length <= max) return value;
  warnings.push(`${label} was truncated to ${max} characters (the structured format's cap).`);
  return value.slice(0, max - 1);
}

// ── date helpers ─────────────────────────────────────────────────────────────

const DATE_PART_RE = /^(?:\d{4})(?:[-/]\d{1,2})?(?:[-/]\d{1,2})?$/;

function normalizeDatePart(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^(present|current|now|ongoing)$/i.test(value)) return "Present";
  return DATE_PART_RE.test(value) ? value.replace(/\//g, "-") : value;
}

function periodText(start?: string, end?: string): string | undefined {
  const from = normalizeDatePart(start ?? "");
  const to = normalizeDatePart(end ?? "");
  if (!from && !to) return undefined;
  if (from && to) return `${from} - ${to}`;
  return from ?? to;
}

// ── import: resume.json / Reactive Resume → RoleSharp ResumeContent ─────────

export type JsonResumeImport = {
  content: ResumeContent;
  warnings: string[];
};

function cappedList<T>(items: T[], max: number, warnings: string[], label: string): T[] {
  if (items.length <= max) return items;
  warnings.push(`${items.length - max} ${label} beyond the ${max}-item cap were dropped.`);
  return items.slice(0, max);
}

export function importFromJsonResume(raw: unknown): JsonResumeImport {
  const warnings: string[] = [];
  const root = record(raw);
  const reactive = "sections" in root;
  const basics = record(root.basics);

  const sections = reactive ? record(root.sections) : {};
  const profile = record(basics.profile);

  const name = text(basics.name) || text(profile.name);
  const email = text(basics.email) || text(profile.email);
  const phone = text(basics.phone) || text(profile.phone);
  const location = record(basics.location);
  const profiles = Array.isArray(basics.profiles) ? basics.profiles.map(record) : [];
  const links: string[] = [
    ...textList(basics.url),
    ...textList(profile.url),
    ...textList(profile.links),
    ...profiles.map((p) => text(first(p, ["url", "username"]))).filter(Boolean),
  ].filter(Boolean).slice(0, 20);

  // Work: standard JSON Resume `work`, Reactive `sections.work.items`,
  // plus `volunteer` (real experience even when unpaid).
  const workEntries = [...objectList(root.work), ...objectList(sections.work), ...objectList(root.volunteer)].map(record);
  const experiences = cappedList(
    workEntries
      .map((item) => {
        const position = text(first(item, ["position", "role", "title"])) || "Experience";
        const company = text(first(item, ["company", "organization", "name", "employer"])) || "";
        const period =
          periodText(
            text(first(item, ["startDate", "start_date", "start", "date"])),
            text(first(item, ["endDate", "end_date", "end"])),
          ) ?? undefined;
        const bullets = cappedList(
          [
            ...textList(item.highlights),
            ...textList(item.bullets),
            ...textList(item.summary),
            ...textList(item.description),
          ].filter(Boolean),
          50,
          warnings,
          "work highlights",
        );
        return { title: position, company, period, bullets };
      })
      .filter((e) => e.company || e.bullets.length),
    50,
    warnings,
    "experiences",
  );

  const educationRaw = objectList(reactive ? sections.education : root.education);
  const education = cappedList(
    educationRaw
      .map((item) => {
        const ed = record(item);
        const studyType = text(first(ed, ["studyType", "degree", "study_type"]));
        const area = text(first(ed, ["area", "field", "major"]));
        const school = text(first(ed, ["institution", "school", "university", "name"]));
        const endDate = text(first(ed, ["endDate", "end_date", "end", "date", "graduationDate"]));
        const year = endDate ? (endDate.match(/\d{4}/)?.[0] ?? endDate) : undefined;
        const courses = textList(ed.courses);
        const score = text(first(ed, ["score", "gpa"]));
        const detailBits = [score ? `Score: ${score}` : "", courses.join(", ")].filter(Boolean);
        return {
          degree: [studyType, area].filter(Boolean).join(", ") || "Education",
          school,
          year,
          detail: detailBits.join(" — ") || undefined,
        };
      })
      .filter((ed) => ed.school || ed.degree !== "Education"),
    30,
    warnings,
    "education entries",
  );

  const skillsRaw = objectList(reactive ? sections.skills : root.skills);
  const skillNames: string[] = [];
  for (const item of skillsRaw) {
    const sk = record(item);
    const visible = [text(sk.name) || text(sk.skill), ...textList(sk.keywords), ...textList(sk.tools)].filter(Boolean);
    for (const value of visible) {
      if (value && !skillNames.some((s) => s.toLowerCase() === value.toLowerCase())) skillNames.push(value);
    }
  }
  const skills = cappedList(skillNames, 100, warnings, "skills").map((s) => clip(s, 500, warnings, "A skill"));

  const projectsRaw = objectList(reactive ? sections.projects : root.projects);
  const projects = cappedList(
    projectsRaw
      .map((item) => {
        const pr = record(item);
        const name = text(first(pr, ["name", "title"])) || "Project";
        const detail = [text(first(pr, ["description", "summary"])), ...textList(pr.highlights)]
          .filter(Boolean)
          .join("\n");
        return { name, detail: clip(detail, 4000, warnings, "A project description") || "See repository." };
      })
      .filter((p) => p.name !== "Project" || p.detail !== "See repository."),
    50,
    warnings,
    "projects",
  );

  const certsRaw = objectList(reactive ? sections.certifications : root.certificates);
  const certifications = cappedList(
    certsRaw.map((c) => text(record(c).name) || text(c)).filter(Boolean),
    100,
    warnings,
    "certifications",
  );

  const langsRaw = objectList(reactive ? sections.languages : root.languages);
  const languages = cappedList(
    langsRaw.map((l) => text(record(l).language) || text(l)).filter(Boolean),
    50,
    warnings,
    "languages",
  );

  const awardsRaw = objectList(root.awards);
  const publicationsRaw = objectList(root.publications);
  const achievements = cappedList(
    [
      ...awardsRaw.map((a) => {
        const aw = record(a);
        const title = text(aw.title) || text(aw.name);
        const summary = text(aw.summary);
        return [title, summary].filter(Boolean).join(" — ");
      }),
      ...publicationsRaw.map((p) => {
        const pub = record(p);
        return [text(pub.name), text(pub.publisher)].filter(Boolean).join(" — ");
      }),
    ].filter(Boolean).map((a) => clip(a, 4000, warnings, "An achievement")),
    100,
    warnings,
    "achievements",
  );

  const headline =
    text(basics.label) ||
    text(basics.headline) ||
    text(profile.headline) ||
    (experiences[0]?.title ?? "") ||
    (name ? `${name}'s resume` : "Imported resume");

  const summarySource = text(basics.summary) || text(profile.summary);
  const summary = summarySource
    ? clip(summarySource, 4000, warnings, "The summary")
    : experiences[0]?.bullets[0] ?? "";

  if (reactive && !Object.keys(sections).length) {
    warnings.push("No sections were found in this file — only contact basics were imported.");
  }

  const content = ResumeContent.parse({
    headline: clip(headline, 500, warnings, "The headline"),
    contact: email || phone || location.city || links.length
      ? {
          email: email || undefined,
          phone: phone || undefined,
          location: text(location.city) || undefined,
          linkedin: links.find((l) => /linkedin\.com/i.test(l)),
          links: links.slice(0, 20),
        }
      : undefined,
    summary,
    skills,
    experiences,
    education,
    projects,
    certifications,
    languages,
    achievements,
  });

  return { content, warnings };
}

// ── export: RoleSharp ResumeContent → resume.json (v1.0.0 shape) ─────────────

export type JsonResumeExport = {
  basics: {
    name: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: { city?: string };
    profiles?: Array<{ network: string; username?: string; url?: string }>;
  };
  work?: Array<{ position: string; name: string; startDate?: string; endDate?: string; highlights?: string[] }>;
  education?: Array<{ institution: string; studyType?: string; endDate?: string }>;
  skills?: Array<{ name: string }>;
  projects?: Array<{ name: string; description: string }>;
  certificates?: Array<{ name: string }>;
  languages?: Array<{ language: string }>;
  awards?: Array<{ title: string }>;
};

function splitPeriod(period?: string): { start?: string; end?: string } {
  if (!period) return {};
  const parts = period.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { start: normalizeDatePart(parts[0]) };
  return { start: normalizeDatePart(parts[0]), end: normalizeDatePart(parts[1]) };
}

export function exportToJsonResume(content: RC, name: string): JsonResumeExport {
  const contact = content.contact;
  const profiles = contact?.linkedin
    ? [{ network: "LinkedIn", url: contact.linkedin }]
    : (contact?.links ?? []).map((url) => ({ network: "Web", url }));

  const out: JsonResumeExport = {
    basics: {
      name,
      label: content.headline,
      email: contact?.email,
      phone: contact?.phone,
      url: (contact?.links ?? [])[0],
      summary: content.summary,
      location: contact?.location ? { city: contact.location } : undefined,
      profiles: profiles.length ? profiles : undefined,
    },
  };

  if (content.experiences.length) {
    out.work = content.experiences.map((e) => {
      const dates = splitPeriod(e.period);
      return {
        position: e.title,
        name: e.company,
        startDate: dates.start,
        endDate: dates.end && dates.end !== "Present" ? dates.end : undefined,
        highlights: e.bullets.length ? e.bullets : undefined,
      };
    });
  }
  if (content.education.length) {
    out.education = content.education.map((ed) => ({
      institution: ed.school,
      studyType: ed.degree,
      endDate: ed.year || undefined,
    }));
  }
  if (content.skills.length) out.skills = content.skills.map((name_) => ({ name: name_ }));
  if ((content.projects ?? []).length) out.projects = content.projects.map((p) => ({ name: p.name, description: p.detail }));
  if ((content.certifications ?? []).length) out.certificates = content.certifications.map((name_) => ({ name: name_ }));
  if ((content.languages ?? []).length) out.languages = content.languages.map((language) => ({ language }));
  if ((content.achievements ?? []).length) out.awards = content.achievements.map((title) => ({ title }));
  return out;
}

// ── export: RoleSharp ResumeContent → RenderCV YAML ──────────────────────────
// Hand-rolled emitter for the fixed shapes we produce (no yaml dependency;
// everything is double-quoted or a block scalar, so the output always
// round-trips). Dates keep source precision: "2020-01" stays "2020-01",
// "2020" stays "2020". A missing start date degrades the entry to RenderCV's
// NormalEntry rather than inventing a timeline.

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlScalar(value: string, indent: number): string {
  if (value.includes("\n")) {
    const pad = " ".repeat(indent);
    const lines = value.split("\n").map((l) => (l.trim() ? pad + l : ""));
    return `|-\n${lines.join("\n")}`;
  }
  return yamlQuote(value);
}

function yamlList(items: string[], indent: number): string {
  const pad = " ".repeat(indent);
  return items.map((item) => `${pad}- ${yamlScalar(item, indent + 2)}`).join("\n");
}

function renderCvDate(part?: string): string | undefined {
  if (!part || part === "Present") return undefined;
  return part;
}

export function exportToRenderCvYaml(content: RC, name: string): string {
  const lines: string[] = [
    "# Generated by RoleSharp (rolesharp.com) — safe to commit and hand-edit.",
    "# Dates keep the precision your resume had: a year stays a year.",
    "design:",
    "  theme: classic",
    "cv:",
    `  name: ${yamlQuote(name)}`,
    "  sections:",
  ];

  if (content.summary.trim()) {
    lines.push("    Summary:");
    lines.push(`      - text: ${yamlScalar(content.summary, 12)}`);
  }

  if (content.experiences.length) {
    lines.push("    Experience:");
    for (const e of content.experiences) {
      const dates = splitPeriod(e.period);
      const startDate = renderCvDate(dates.start);
      if (startDate) {
        lines.push(`      - company: ${yamlQuote(e.company)}`);
        lines.push(`        position: ${yamlQuote(e.title)}`);
        lines.push(`        startDate: ${yamlQuote(startDate)}`);
        const endDate = renderCvDate(dates.end);
        lines.push(`        endDate: ${yamlQuote(endDate ?? "present")}`);
        if (e.bullets.length) {
          lines.push("        highlights:");
          lines.push(yamlList(e.bullets, 10));
        }
      } else {
        // No parseable start date: NormalEntry keeps the period as display text
        // instead of a fabricated timeline.
        lines.push(`      - name: ${yamlQuote(`${e.title} — ${e.company}`)}`);
        if (e.period) lines.push(`        date: ${yamlQuote(e.period)}`);
        lines.push(`        description: ${yamlScalar(e.bullets.join("\n") || e.title, 10)}`);
      }
    }
  }

  if (content.education.length) {
    lines.push("    Education:");
    for (const ed of content.education) {
      const endDate = renderCvDate(ed.year);
      lines.push(`      - institution: ${yamlQuote(ed.school)}`);
      if (ed.degree) lines.push(`        area: ${yamlQuote(ed.degree)}`);
      if (endDate) lines.push(`        endDate: ${yamlQuote(endDate)}`);
      if (ed.detail) lines.push(`        summary: ${yamlScalar(ed.detail, 10)}`);
    }
  }

  if (content.skills.length) {
    lines.push("    Skills:");
    lines.push(`      - text: ${yamlScalar(content.skills.join(", "), 12)}`);
  }

  if ((content.projects ?? []).length) {
    lines.push("    Projects:");
    for (const p of content.projects) {
      lines.push(`      - name: ${yamlQuote(p.name)}`);
      lines.push(`        description: ${yamlScalar(p.detail, 10)}`);
    }
  }

  if ((content.certifications ?? []).length) {
    lines.push("    Certifications:");
    for (const cert of content.certifications) {
      lines.push(`      - label: ${yamlQuote(cert)}`);
    }
  }

  if ((content.languages ?? []).length) {
    lines.push("    Languages:");
    for (const language of content.languages) {
      lines.push(`      - label: ${yamlQuote(language)}`);
    }
  }

  if ((content.achievements ?? []).length) {
    lines.push("    Achievements:");
    for (const achievement of content.achievements) {
      lines.push(`      - bullet: ${yamlScalar(achievement, 10)}`);
    }
  }

  return lines.join("\n") + "\n";
}

// ── ATS text compile ──────────────────────────────────────────────────────────
// The same flattening every renderer and scorer uses — one text-layer truth,
// ready to paste into /build, /checker, or /resume-match.

export function compileStructuredResumeToAtsText(content: RC): string {
  return resumeSourceText(content);
}
