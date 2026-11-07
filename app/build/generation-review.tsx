"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Check,
  FileText,
  Info,
  Pencil,
  Shield,
  Sparkles,
  Target,
  User,
} from "../icons";
import type { GenerateRequest } from "@/lib/types";

export type ReviewSection = "profile" | "target" | "evidence" | "extras";
export type ReviewRequest = Omit<GenerateRequest, "deviceId">;

function SectionCard({
  title,
  icon,
  onEdit,
  children,
  badge,
  editAriaLabel,
}: {
  title: string;
  icon: ReactNode;
  onEdit: () => void;
  children: ReactNode;
  badge?: string;
  editAriaLabel?: string;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 transition-all shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)] shrink-0"
            aria-hidden="true"
          >
            {icon}
          </span>
          <h3 className="text-base font-bold text-[var(--fg)]">{title}</h3>
          {badge && (
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted-fg)] border border-[var(--border)]">
              {badge}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          leftIcon={<Pencil size={13} aria-hidden="true" />}
          aria-label={editAriaLabel || `Edit ${title.toLowerCase()}`}
          className="text-xs font-semibold"
        >
          Edit section
        </Button>
      </div>
      {children}
    </section>
  );
}

function DetailGrid({ rows }: { rows: [string, string | undefined][] }) {
  const filled = rows.filter(([, value]) => value && value.trim());
  if (!filled.length) {
    return <p className="text-sm italic text-[var(--muted-fg)]">No details added for this section.</p>;
  }

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
      {filled.map(([label, value]) => (
        <div key={label} className={value && value.length > 60 ? "sm:col-span-2" : ""}>
          <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted-fg)] mb-0.5">{label}</dt>
          <dd className="whitespace-pre-wrap break-words text-[var(--fg)] font-medium leading-relaxed">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface GenerationReviewProps {
  request: ReviewRequest;
  company: string;
  role: string;
  onEdit: (section: ReviewSection) => void;
  onBack: () => void;
  onConfirm: () => void;
  busy?: boolean;
  err?: string;
}

export default function GenerationReview({
  request,
  company,
  role,
  onEdit,
  onBack,
  onConfirm,
  busy = false,
  err = "",
}: GenerationReviewProps) {
  const { profile } = request;

  // Evidence diagnostics
  const validSkills = (profile.skills || []).map((s) => s.trim()).filter(Boolean);
  const quantifiedBulletsCount = (profile.experiences || []).reduce((acc, exp) => {
    return (
      acc +
      (exp.bullets || []).filter(
        (b) => /\d/.test(b) || /\b(increased|reduced|grew|saved|doubled|tripled)\b/i.test(b),
      ).length
    );
  }, 0);

  const hasMinimalExperience =
    (profile.experiences?.length || 0) === 0 && (profile.education?.length || 0) === 0;
  const isJdShort = (request.jdText?.trim().length || 0) < 50;

  return (
    <section id="step-review-confirm" aria-label="Review your resume details" className="review-step-workspace card p-5 sm:p-8 space-y-6">
      {/* 1. Header Banner */}
      <header className="border-b border-[var(--hairline)] pb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
            <Sparkles size={14} aria-hidden="true" />
            <span>Step 4 • Pre-Generation Verification</span>
          </div>
          <span className="text-xs font-semibold text-[var(--muted-fg)] bg-[var(--surface-2)] px-2.5 py-1 rounded-full border border-[var(--border)]">
            Ready to review
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--fg)]">
          Review & confirm your details
        </h2>
        <p className="text-sm sm:text-base text-[var(--muted-fg)] max-w-2xl leading-relaxed">
          Confirm every detail below before sending to the tailoring engine. Every resume bullet is grounded strictly in your verified inputs.
        </p>

        {/* Mandatory Product Safety & Truth Principle */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs sm:text-sm text-[var(--muted-fg)]">
          <Shield size={18} className="text-[var(--primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <strong className="block text-[var(--fg)] font-bold text-sm">
              Safe tailoring principle
            </strong>
            <p className="leading-relaxed">
              &ldquo;Only details you provide are used. Review them before generating.&rdquo;
              RoleSharp exclusively tailors your resume from the background, achievements, and target requirements you entered without inventing fictional qualifications.
            </p>
          </div>
        </div>

        {/* Input quality notices */}
        {hasMinimalExperience && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)] p-3 text-xs text-[var(--warning)]"
          >
            <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Note:</strong> No work experience or education entered yet. While you can still generate a draft, adding at least one past role or degree drastically improves your ATS match score.
            </span>
          </div>
        )}

        {isJdShort && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted-fg)]"
          >
            <Info size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Job posting tip:</strong> The pasted job description is brief ({request.jdText?.trim().length || 0} characters). Including key responsibilities and requirements helps the engine align your resume&rsquo;s language with the recruiter&rsquo;s exact rubric.
            </span>
          </div>
        )}

        {err && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-3 text-xs sm:text-sm text-[var(--danger)]"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{err}</span>
          </div>
        )}
      </header>

      {/* 2. Structured Section Cards */}
      <div className="space-y-4">
        {/* Card 1: Target Role & Company */}
        <SectionCard
          title="Target job & role"
          icon={<Target size={16} aria-hidden="true" />}
          onEdit={() => onEdit("target")}
          badge={role || "General"}
          editAriaLabel="Edit target role and company"
        >
          <DetailGrid
            rows={[
              ["Target role", role || "Not specified"],
              ["Company / employer", company || "Not specified"],
              [
                "Job description",
                request.jdText
                  ? `${request.jdText.slice(0, 320)}${request.jdText.length > 320 ? "..." : ""} (${request.jdText.split(/\s+/).filter(Boolean).length} words)`
                  : "No job description pasted",
              ],
              [
                "Selected template",
                request.template
                  ? `${request.template[0].toUpperCase()}${request.template.slice(1)} style`
                  : "Basic",
              ],
            ]}
          />
        </SectionCard>

        {/* Card 2: Profile & Contact */}
        <SectionCard
          title="Personal & contact details"
          icon={<User size={16} aria-hidden="true" />}
          onEdit={() => onEdit("profile")}
          editAriaLabel="Edit personal and contact details"
        >
          <DetailGrid
            rows={[
              ["Full name", profile.name],
              ["Email", profile.email],
              ["Phone", profile.phone],
              ["Location", profile.location],
              ["Career level", profile.careerLevel],
              ["LinkedIn profile", profile.linkedin],
              [
                "Portfolio / links",
                profile.links && profile.links.length ? profile.links.join(", ") : undefined,
              ],
              ["Professional summary", profile.summary],
            ]}
          />
        </SectionCard>

        {/* Card 3: Skills Inventory */}
        <SectionCard
          title="Skills inventory"
          icon={<Sparkles size={16} aria-hidden="true" />}
          onEdit={() => onEdit("evidence")}
          badge={`${validSkills.length} skills`}
          editAriaLabel="Edit resume evidence"
        >
          {validSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {validSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--fg)]"
                >
                  <Check size={12} className="text-[var(--primary)]" aria-hidden="true" />
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-[var(--muted-fg)]">No individual skills added yet.</p>
          )}
        </SectionCard>

        {/* Card 4: Work Experience & Evidence */}
        <SectionCard
          title="Work experience & evidence"
          icon={<Briefcase size={16} aria-hidden="true" />}
          onEdit={() => onEdit("evidence")}
          badge={`${profile.experiences?.length || 0} roles · ${quantifiedBulletsCount} quantified`}
          editAriaLabel="Edit work experience"
        >
          {profile.experiences && profile.experiences.length > 0 ? (
            <div className="space-y-4 pt-1">
              {profile.experiences.map((entry, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] p-4 space-y-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--hairline)] pb-2">
                    <strong className="text-sm font-bold text-[var(--fg)]">
                      {[entry.title, entry.company].filter(Boolean).join(" · ")}
                    </strong>
                    <span className="text-xs text-[var(--muted-fg)] font-medium">
                      {[entry.location, [entry.start, entry.end].filter(Boolean).join(" – ")].filter(Boolean).join(" | ")}
                    </span>
                  </div>

                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="space-y-2 text-xs sm:text-sm text-[var(--muted-fg)]">
                      {entry.bullets.map((b, bi) => {
                        const isQuantified =
                          /\d/.test(b) ||
                          /\b(increased|reduced|grew|saved|doubled|tripled)\b/i.test(b);
                        return (
                          <li key={bi} className="flex items-start gap-2">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 mt-2 ${isQuantified ? "bg-[var(--success)]" : "bg-[var(--border)]"}`}
                              aria-hidden="true"
                            />
                            <span className="leading-relaxed">
                              {b}
                              {isQuantified && (
                                <span className="ml-2 inline-block rounded bg-[var(--success-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--success)]">
                                  ✓ Quantified
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-[var(--muted-fg)]">No work experience roles listed.</p>
          )}
        </SectionCard>

        {/* Card 5: Education, Projects & Credentials */}
        <SectionCard
          title="Education, projects & credentials"
          icon={<FileText size={16} aria-hidden="true" />}
          onEdit={() => onEdit("extras")}
          editAriaLabel="Edit education, projects and credentials"
        >
          <DetailGrid
            rows={[
              [
                "Education",
                profile.education && profile.education.length
                  ? profile.education
                      .map((e) => [e.degree, e.school, e.year, e.detail].filter(Boolean).join(" · "))
                      .join("\n")
                  : undefined,
              ],
              [
                "Projects",
                profile.projects && profile.projects.length
                  ? profile.projects.map((p) => `${p.name}: ${p.detail}`).join("\n")
                  : undefined,
              ],
              [
                "Certifications",
                profile.certifications && profile.certifications.length
                  ? profile.certifications.join(", ")
                  : undefined,
              ],
              [
                "Languages",
                profile.languages && profile.languages.length ? profile.languages.join(", ") : undefined,
              ],
              [
                "Achievements",
                profile.achievements && profile.achievements.length
                  ? profile.achievements.join(", ")
                  : undefined,
              ],
            ]}
          />
        </SectionCard>
      </div>

      {/* 3. Confirmation Action Bar */}
      <footer className="pt-4 border-t border-[var(--border)] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={busy}
          leftIcon={<ArrowLeft size={16} aria-hidden="true" />}
          className="font-medium text-sm"
        >
          ← Back to edit form
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onConfirm}
          disabled={busy}
          isLoading={busy}
          leftIcon={<Sparkles size={16} aria-hidden="true" />}
          className="font-bold text-sm sm:text-base shadow-sm"
        >
          {busy ? "Generating tailored draft…" : "Confirm & generate resume"}
        </Button>
      </footer>
    </section>
  );
}
