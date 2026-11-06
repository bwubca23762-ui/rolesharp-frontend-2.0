import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { Button } from "@/components/ui/primitives";
import type { GenerateRequest } from "@/lib/types";

export type ReviewSection = "profile" | "target" | "evidence" | "extras";
export type ReviewRequest = Omit<GenerateRequest, "deviceId">;

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>Edit</Button>
      </div>
      {children}
    </section>
  );
}

function Details({ rows }: { rows: [string, string | undefined][] }) {
  const filled = rows.filter(([, value]) => value?.trim());
  if (!filled.length) return <p className="text-sm text-[var(--muted-fg)]">No details added.</p>;

  return (
    <dl className="grid gap-3 text-sm">
      {filled.map(([label, value]) => (
        <div key={label}>
          <dt className="font-semibold">{label}</dt>
          <dd className="whitespace-pre-wrap break-words text-[var(--muted-fg)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GenerationReview({ request, company, role, onEdit, onClose, onConfirm }: {
  request: ReviewRequest;
  company: string;
  role: string;
  onEdit: (section: ReviewSection) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { profile } = request;

  // The page entrance transform makes a fixed overlay inside it scroll with the page.
  return createPortal(
    <AccessibleDialog label="Review your resume details" onClose={onClose}>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7">
        <header className="py-5">
          <h2 className="text-xl font-semibold">Review your resume details</h2>
          <p className="mt-2 text-sm text-[var(--muted-fg)]">Check what you entered and edit any section before sending your details for generation.</p>
        </header>
        <Section title="Profile" onEdit={() => onEdit("profile")}>
          <Details rows={[
            ["Full name", profile.name], ["Email", profile.email], ["Phone", profile.phone],
            ["Location", profile.location], ["Career level", profile.careerLevel],
            ["LinkedIn", profile.linkedin], ["Other links", profile.links.join("\n")], ["Summary", profile.summary],
          ]} />
        </Section>
        <Section title="Target job" onEdit={() => onEdit("target")}>
          <Details rows={[["Role", role], ["Company", company], ["Job description", request.jdText]]} />
        </Section>
        <Section title="Resume evidence" onEdit={() => onEdit("evidence")}>
          <Details rows={[
            ["Skills", profile.skills.join("\n")],
            ["Work experience", profile.experiences.map((entry) => [
              [entry.title, entry.company].filter(Boolean).join(" at "),
              [entry.location, [entry.start, entry.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · "),
              ...entry.bullets.map((bullet) => `• ${bullet}`),
              ...Object.entries(entry.impactFacts ?? {}).filter(([, value]) => value).map(([label, value]) => `${label[0].toUpperCase()}${label.slice(1)}: ${value}`),
            ].filter(Boolean).join("\n")).join("\n\n")],
            ["Education", profile.education.map((entry) => [entry.degree, entry.school, entry.year, entry.detail].filter(Boolean).join(" · ")).join("\n")],
            ["Projects", profile.projects.map((entry) => `${entry.name}: ${entry.detail}`).join("\n")],
          ]} />
        </Section>
        <Section title="Additional details" onEdit={() => onEdit("extras")}>
          <Details rows={[
            ["Certifications", profile.certifications.join("\n")], ["Languages", profile.languages.join("\n")],
            ["Achievements", profile.achievements.join("\n")], ["Template", request.template],
          ]} />
        </Section>
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3 sm:px-7">
        <Button type="button" variant="outline" onClick={onClose}>Back to form</Button>
        <Button type="button" onClick={onConfirm}>Generate resume</Button>
      </footer>
    </AccessibleDialog>,
    document.body,
  );
}
