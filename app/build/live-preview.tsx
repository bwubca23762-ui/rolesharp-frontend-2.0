"use client";
import type { ExperienceEntry } from "./experience-cards";
import Image from "next/image";

export type PreviewData = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  links: string[];
  summary: string;
  skills: string[];
  experiences: ExperienceEntry[];
  education: { degree: string; school: string; year?: string; detail?: string }[];
  projects: { name: string; detail: string }[];
  certifications: string[];
  languages: string[];
  achievements: string[];
  photoDataUrl?: string;
};

function period(e: ExperienceEntry) {
  const end = e.current ? "Present" : e.end.trim();
  return [e.start.trim(), end].filter(Boolean).join(" – ");
}

// Live HTML mirror of the resume — updates instantly as the user types.
// Mimics the exported PDF layout so the preview feels true to the result.
// Each section carries a data-rs-section attribute so clicking it scrolls the
// form to the matching field (SmartEdit-inspired bidirectional editing).
export default function LivePreview({
  data,
  onSectionClick,
  highlightedSection,
  minHeight,
}: {
  data: PreviewData;
  onSectionClick?: (section: string) => void;
  highlightedSection?: string | null;
  minHeight?: number;
}) {
  const clickable = !!onSectionClick;
  const sec = (id: string, cls = "") =>
    `lp-sec ${clickable ? "clickable" : ""} ${highlightedSection === id ? "highlighted" : ""} ${cls}`.trim();

  const headline = [data.role, data.company].filter(Boolean).join(" — ");
  const contact = [data.email, data.phone, data.location, data.linkedin, ...data.links].filter(Boolean);
  const hasExp = data.experiences.some((e) => e.company || e.title || e.bullets.some((b) => b.trim()));

  return (
    <div className="lp-page" aria-label="Live resume preview" style={{ minHeight }}>
      <header className={`lp-head ${data.photoDataUrl ? "lp-head-with-photo" : ""}`} data-rs-section="profile" onClick={() => onSectionClick?.("profile")}>
        <div className="lp-head-copy">
          <h2 className="lp-name">{data.name || "Your Name"}</h2>
          {headline && <div className="lp-headline">{headline}</div>}
          {contact.length > 0 && <div className="lp-contact">{contact.join("  •  ")}</div>}
        </div>
        {data.photoDataUrl && <Image className="lp-photo" src={data.photoDataUrl} alt="Resume headshot preview" width={64} height={64} unoptimized />}
      </header>

      {data.summary.trim() && (
        <section className={sec("summary")} data-rs-section="summary" onClick={() => onSectionClick?.("summary")}>
          <h2 className="lp-h">Summary</h2>
          <p className="lp-summary">{data.summary.trim()}</p>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className={sec("skills")} data-rs-section="skills" onClick={() => onSectionClick?.("skills")}>
          <h2 className="lp-h">Skills</h2>
          <div className="lp-skills">{data.skills.map((s, i) => <span className="lp-skill" key={i}>{s}</span>)}</div>
        </section>
      )}

      {hasExp && (
        <section className={sec("experience")} data-rs-section="experience" onClick={() => onSectionClick?.("experience")}>
          <h2 className="lp-h">Experience</h2>
          {data.experiences.filter((e) => e.company || e.title || e.bullets.some((b) => b.trim())).map((e) => (
            <div className="lp-item" key={e.id}>
              <div className="lp-item-top">
                <strong>{e.title || "Role"}{e.company ? ` — ${e.company}` : ""}</strong>
                {period(e) && <span className="lp-period">{period(e)}</span>}
              </div>
              {e.location.trim() && <div className="lp-sub">{e.location.trim()}</div>}
              <ul className="lp-bullets">
                {e.bullets.filter((b) => b.trim()).map((b, bi) => <li key={bi}>{b.trim()}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {data.education.length > 0 && (
        <section className={sec("education")} data-rs-section="education" onClick={() => onSectionClick?.("education")}>
          <h2 className="lp-h">Education</h2>
          {data.education.map((ed, i) => (
            <div className="lp-item" key={i}>
              <div className="lp-item-top">
                <strong>{ed.degree}{ed.school ? ` — ${ed.school}` : ""}</strong>
                {ed.year && <span className="lp-period">{ed.year}</span>}
              </div>
              {ed.detail && <div className="lp-sub">{ed.detail}</div>}
            </div>
          ))}
        </section>
      )}

      {data.projects.length > 0 && (
        <section className={sec("projects")} data-rs-section="projects" onClick={() => onSectionClick?.("projects")}>
          <h2 className="lp-h">Projects</h2>
          {data.projects.map((p, i) => (
            <div className="lp-item" key={i}>
              <strong>{p.name}</strong>
              {p.detail && <div className="lp-sub">{p.detail}</div>}
            </div>
          ))}
        </section>
      )}

      {(data.certifications.length > 0 || data.languages.length > 0 || data.achievements.length > 0) && (
        <section className={sec("extras", "lp-extras")} data-rs-section="extras" onClick={() => onSectionClick?.("extras")}>
          {data.certifications.length > 0 && <div><b>Certifications:</b> {data.certifications.join(", ")}</div>}
          {data.languages.length > 0 && <div><b>Languages:</b> {data.languages.join(", ")}</div>}
          {data.achievements.length > 0 && (
            <div><b>Achievements:</b>
              <ul className="lp-bullets">{data.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {!data.name && !headline && !data.summary.trim() && data.skills.length === 0 && !hasExp && (
        <p className="lp-empty">Start filling the form — your resume builds here in real time.</p>
      )}
    </div>
  );
}
