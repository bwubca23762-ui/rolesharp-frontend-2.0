"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import {  Download, FileText, Plus, Trash, User, Briefcase, Lock, Upload , Check } from "../icons";
import LivePreview, { type PreviewData } from "../build/live-preview";
import { FaqSection } from "../seo-blocks";
import { newExperience, type ExperienceEntry } from "../build/experience-cards";
import { atsDiagnostics } from "@/lib/ats-score";
import { buildContactLinks, extractLinkedinUrl, normalizeLinkedinUrl } from "@/lib/contact-links";
import type { ResumeContent } from "@/lib/types";
import { COMPANY_GUIDANCE, COMPANY_TYPE_KEYS, type CompanyType } from "@/lib/resume-guidance";
import { Badge, Button, Notice, ToolShell } from "@/components/ui/primitives";
import CountryPicker, { type Country } from "@/components/ui/CountryPicker";
import { resumePhotoPolicy } from "@/lib/resume-photo";
import { useSession } from "../session-context";
import { bulletLines, parseEducation, parseProjects, splitList } from "@/lib/resume-form/parse";
import { resumeContentToFormFields } from "@/lib/resume-form/from-resume-content";
import PreviewModal from "@/components/ui/PreviewModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useLocalDraft } from "@/lib/resume-form/use-local-draft";
import { useWorkspacePublisher } from "@/lib/resume-form/use-workspace-publisher";
import { previewText } from "@/lib/resume-form/preview-text";
import { trackProductEvent } from "../product-analytics";
import { errorMessage } from "@/lib/error-message";
import CertificationsPicker from "@/components/tools/CertificationsPicker";

// Export renders locally with no model call, so this only has to outlast a slow
// PDF/DOCX build — it exists so a stalled request fails visibly instead of
// leaving the button spinning forever.
const EXPORT_TIMEOUT_MS = 120_000;

// Every id the export engine renders (PALETTES in lib/pdf.tsx). "executive" and
// "elegant" were missing here while /build offered all seven, so two real
// templates existed, were advertised, and could not be picked on this page.
const TEMPLATES = ["basic", "modern", "compact", "minimal", "technical", "elegant", "executive"];
const MAKER_DRAFT_KEY = "rolesharp-maker-draft";
const MAKER_DRAFT_VERSION = 1;
const MAKER_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

type MakerDraft = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  links: string;
  summary: string;
  skills: string;
  experiences: ExperienceEntry[];
  education: string;
  projects: string;
  certifications: string;
  languages: string;
  achievements: string;
  jdText: string;
  template: string;
  companyType: CompanyType;
  targetCountry: Country | null;
  employerRequestedPhoto: boolean;
};

function importedSummary(value: string) {
  return bulletLines(value)
    .filter((line) => line.length >= 40 && line.length <= 220)
    .filter((line) => !/@|https?:\/\/|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i.test(line))
    .slice(0, 2)
    .join(" ");
}

function importedBullets(value: string) {
  return bulletLines(value)
    .filter((line) => line.length >= 30 && line.length <= 220)
    .filter((line) => /^(built|created|developed|led|managed|owned|delivered|improved|reduced|increased|supported|handled|worked|responsible|assisted|helped)/i.test(line) || /\d|%|\$|₹|users|customers|clients|revenue|saved|reduced|increased/i.test(line))
    .slice(0, 5);
}

function period(e: ExperienceEntry) {
  return [e.start.trim(), e.current ? "Present" : e.end.trim()].filter(Boolean).join(" - ");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function prepareResumePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error("Choose a JPG, PNG, or WebP image."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Photo must be smaller than 5 MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 480;
      canvas.getContext("2d")?.drawImage(image, sx, sy, side, side, 0, 0, 480, 480);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    image.src = url;
  });
}

export default function ResumeMaker() {
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([newExperience({ title: "", company: "", bullets: [""] })]);
  const [education, setEducation] = useState("");
  const [projects, setProjects] = useState("");
  const [certifications, setCertifications] = useState("");
  const [languages, setLanguages] = useState("");
  const [achievements, setAchievements] = useState("");
  const [jdText, setJdText] = useState("");
  const [template, setTemplate] = useState("basic");
  const [companyType, setCompanyType] = useState<CompanyType>("general");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  // A blank form is the reason most people who arrive here never finish one.
  // Importing a LinkedIn export fills it from evidence the user already wrote.
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState("");
  const { session: me } = useSession();
  const [targetCountry, setTargetCountry] = useState<Country | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [employerRequestedPhoto, setEmployerRequestedPhoto] = useState(false);
  const [confirmClearDraft, setConfirmClearDraft] = useState(false);

  // DOCX is a tier feature, not a premium-until synonym — a student account is
  // premium but deliberately carries docxExport: false (lib/tier-features.ts).
  const docxAllowed = me?.features?.docxExport ?? false;
  const photoPolicy = useMemo(() => resumePhotoPolicy(targetCountry?.rules), [targetCountry]);
  const photoAllowed = photoPolicy.status !== "prohibited" && (photoPolicy.status !== "discouraged" || employerRequestedPhoto);

  useEffect(() => {
    if (!photoAllowed) setPhotoDataUrl("");
  }, [photoAllowed]);

  // The generator handoff stashes the generated
  // summary/bullets in sessionStorage. Consume + clear it here.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("rolesharp-maker-import"); } catch {}
    if (!raw) return;
    try {
      sessionStorage.removeItem("rolesharp-maker-import");
      const imported = JSON.parse(raw) as { tool?: string; text?: string; bullets?: string[] };
      const bulletList = (imported.bullets ?? []).filter(Boolean);
      if ((imported.tool === "bullets" || imported.tool === "experience") && bulletList.length) {
        setExperiences((current) => {
          const first = current[0] ?? newExperience();
          const merged = [...first.bullets.filter(Boolean), ...bulletList].slice(0, 12);
          return [newExperience({ ...first, bullets: merged }), ...current.slice(1)];
        });
      } else if (imported.text) {
        const text = imported.text;
        setSummary((current) => current.trim() || text);
      }
    } catch {
      // Malformed handoff data must not wedge the maker — ignore it.
    }
  }, []);

  // Photos are deliberately excluded from `value`: device-local drafts retain
  // form text, not large data URLs or image bytes.
  const { status: draftStatus, clear: clearDraft } = useLocalDraft<MakerDraft>({
    key: MAKER_DRAFT_KEY,
    version: MAKER_DRAFT_VERSION,
    maxAgeMs: MAKER_DRAFT_MAX_AGE_MS,
    value: {
      name, headline, email, phone, linkedin, location, links, summary, skills,
      experiences, education, projects, certifications, languages, achievements,
      jdText, template, companyType, targetCountry, employerRequestedPhoto,
    },
    onRestore: (draft) => {
      setName(draft.name || "");
      setHeadline(draft.headline || "");
      setEmail(draft.email || "");
      setPhone(draft.phone || "");
      setLinkedin(draft.linkedin || "");
      setLocation(draft.location || "");
      setLinks(draft.links || "");
      setSummary(draft.summary || "");
      setSkills(draft.skills || "");
      if (Array.isArray(draft.experiences) && draft.experiences.length) {
        setExperiences(draft.experiences.map((experience) => newExperience(experience)));
      }
      setEducation(draft.education || "");
      setProjects(draft.projects || "");
      setCertifications(draft.certifications || "");
      setLanguages(draft.languages || "");
      setAchievements(draft.achievements || "");
      setJdText(draft.jdText || "");
      if (TEMPLATES.includes(draft.template)) setTemplate(draft.template);
      if (COMPANY_TYPE_KEYS.includes(draft.companyType)) setCompanyType(draft.companyType);
      setTargetCountry(draft.targetCountry || null);
      setEmployerRequestedPhoto(Boolean(draft.employerRequestedPhoto));
    },
  });

  // /resume-templates sends people here with the template they picked. Without
  // this the "Use this template" CTA landed them on a page where they had to
  // find and re-pick it by hand — the label promised something the destination
  // did not do. Runs after the draft restore above, so an explicit choice in
  // the URL wins over whatever the last draft happened to be saved with.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("template");
    if (requested && TEMPLATES.includes(requested)) setTemplate(requested);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("rolesharp-fixer-source");
    if (!raw) return;

    try {
      const imported = JSON.parse(raw) as { resumeText?: string; role?: string; jdText?: string; linkedin?: string };
      const text = imported.resumeText || "";
      const importedRole = imported.role?.trim() || "";
      const starterSummary = importedSummary(text);
      const starterBullets = importedBullets(text);
      const starterLinkedin = imported.linkedin || extractLinkedinUrl(text);

      if (importedRole) setHeadline(importedRole);
      if (imported.jdText) setJdText(imported.jdText);
      if (starterSummary) setSummary(starterSummary);
      if (starterLinkedin) setLinkedin(starterLinkedin);
      if (starterBullets.length) {
        setExperiences([newExperience({ title: importedRole || "Experience", company: "", bullets: starterBullets })]);
      }
    } catch {
      // Ignore malformed handoff data and keep the maker fully manual.
    } finally {
      localStorage.removeItem("rolesharp-fixer-source");
    }
  }, []);

  // Apply parsed resume content onto the flat maker fields. Non-empty
  // current values win: a load must refine, never silently overwrite what
  // the user already typed.
  function applyMakerFields(fields: {
    name: string; headline: string; email: string; phone: string; linkedin: string;
    location: string; links: string; summary: string; skills: string; education: string;
    projects: string; certifications: string; languages: string; achievements: string;
    experiences: Parameters<typeof newExperience>[0][];
  }) {
    if (fields.name && !name.trim()) setName(fields.name);
    if (fields.headline && !headline.trim()) setHeadline(fields.headline);
    if (!email.trim()) setEmail(fields.email);
    if (!phone.trim()) setPhone(fields.phone);
    if (!linkedin.trim()) setLinkedin(fields.linkedin);
    if (!location.trim()) setLocation(fields.location);
    if (!links.trim()) setLinks(fields.links);
    if (fields.summary && !summary.trim()) setSummary(fields.summary);
    if (fields.skills && !skills.trim()) setSkills(fields.skills);
    if (fields.education && !education.trim()) setEducation(fields.education);
    if (fields.projects && !projects.trim()) setProjects(fields.projects);
    if (fields.certifications && !certifications.trim()) setCertifications(fields.certifications);
    if (fields.languages && !languages.trim()) setLanguages(fields.languages);
    if (fields.achievements && !achievements.trim()) setAchievements(fields.achievements);
    if (fields.experiences.length) {
      setExperiences(fields.experiences.map((entry) => newExperience(entry)));
    }
  }

  // ?resumeId=... lands here from /resumes/[id] ("Edit in Visual Maker") and
  // the dashboard: prefill the form from the saved resume's structured content.
  // The ref keeps the one-shot mount effect reading the freshest closure
  // without re-running on every render (same pattern the builder uses).
  const applyMakerFieldsRef = useRef(applyMakerFields);
  applyMakerFieldsRef.current = applyMakerFields;
  useEffect(() => {
    const resumeId = new URLSearchParams(window.location.search).get("resumeId");
    if (!resumeId || !/^[0-9a-f-]{36}$/i.test(resumeId)) return;
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error === "login_required" ? "Please log in again to load that resume." : "Could not load that resume.");
        if (!active) return;
        applyMakerFieldsRef.current(resumeContentToFormFields(j.content, j.candidateName ?? ""));
        setErr("");
      } catch (e: any) {
        if (active) setErr(e?.message || "Could not load that resume.");
      }
    })();
    return () => { active = false; };
  }, []);

  const previewData: PreviewData = useMemo(() => ({
    name,
    role: headline,
    company: "",
    email,
    phone,
    linkedin: linkedin.trim() ? normalizeLinkedinUrl(linkedin) : "",
    location,
    links: buildContactLinks(linkedin, splitList(links)).filter((link) => !/linkedin\.com\/in\//i.test(link)),
    summary,
    skills: splitList(skills),
    experiences,
    education: parseEducation(education),
    projects: parseProjects(projects),
    certifications: bulletLines(certifications),
    languages: splitList(languages),
    achievements: bulletLines(achievements),
    photoDataUrl: photoDataUrl || undefined,
  }), [name, headline, email, phone, linkedin, location, links, summary, skills, experiences, education, projects, certifications, languages, achievements, photoDataUrl]);

  const markWorkspaceEdited = useWorkspacePublisher({ resumeText: previewText(previewData), jdText, targetRole: headline }, "resume-maker");

  const content: ResumeContent = useMemo(() => ({
    headline: headline || "Professional Resume",
    contact: {
      email: email || undefined,
      phone: phone || undefined,
      linkedin: linkedin.trim() ? normalizeLinkedinUrl(linkedin) : undefined,
      location: location || undefined,
      links: buildContactLinks(linkedin, splitList(links)).filter((link) => !/linkedin\.com\/in\//i.test(link)).length
        ? buildContactLinks(linkedin, splitList(links)).filter((link) => !/linkedin\.com\/in\//i.test(link))
        : undefined,
    },
    summary: summary || `${headline || "Professional"} with practical experience, clear communication, and a track record of dependable execution.`,
    skills: splitList(skills),
    experiences: experiences
      .filter((e) => e.title.trim() || e.company.trim() || e.bullets.some((b) => b.trim()))
      .map((e) => ({
        title: e.title.trim() || "Experience",
        company: e.company.trim(),
        period: period(e) || undefined,
        bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
      })),
    education: parseEducation(education),
    projects: parseProjects(projects),
    certifications: bulletLines(certifications),
    languages: splitList(languages),
    achievements: bulletLines(achievements),
  }), [headline, email, phone, linkedin, location, links, summary, skills, experiences, education, projects, certifications, languages, achievements]);


  // Context-aware: headline carries the role, the candidate's own skills feed
  // the hard-skill group — without them the meter suppressed 16-26 points and
  // graded skill-rich no-JD drafts at 0% hard-skill coverage.
  const diagnostics = useMemo(() => atsDiagnostics(jdText, content, {
    targetRole: headline.trim() || undefined,
    roleSkills: content.skills.length ? content.skills : undefined,
  }), [jdText, content, headline]);
  const ready = name.trim() && (email.trim() || phone.trim()) && content.skills.length >= 3 && (content.experiences.length || content.education.length || content.projects.length);
  const hasPreviewContent = name.trim() || summary.trim() || skills.trim() || experiences.some((e) => e.title.trim() || e.company.trim() || e.bullets.some((b) => b.trim()));

  function updateExp(id: string, patch: Partial<ExperienceEntry>) {
    setExperiences((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function updateBullet(id: string, idx: number, value: string) {
    setExperiences((rows) => rows.map((row) => row.id === id ? { ...row, bullets: row.bullets.map((b, i) => i === idx ? value : b) } : row));
  }

  // Save the maker's content to the account's resumes — the maker has no
  // generation pipeline, so nothing was persisted until now and exports were
  // the only artefact. Free: no model call, no credit.
  async function saveToAccount() {
    if (busy) return;
    if (!name.trim()) {
      setErr("Add a name before saving — My Resumes files it under that title.");
      return;
    }
    setErr("");
    setBusy("save");
    try {
      const r = await fetch("/api/resume/save-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), template, content: { ...content, experiences } }),
        signal: AbortSignal.timeout(30_000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = "/login?next=/resume-maker"; return; }
      if (!r.ok) throw new Error(errorMessage(j?.error, "Could not save the resume right now."));
      trackProductEvent("tool_meaningful_start", { context: "maker:saved_to_account" });
      window.location.href = `/resumes/${j.id}`;
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : e?.message || "Could not save the resume.");
    } finally {
      setBusy("");
    }
  }

  async function exportFile(kind: "pdf" | "docx") {
    if (busy) return; // one click, one export
    setErr("");
    if (!ready) {
      trackProductEvent("tool_start_blocked", {
        context: kind === "pdf" ? "maker:incomplete_pdf" : "maker:incomplete_docx",
      });
      setErr("Add name, contact, skills, and at least education, experience, or projects before exporting.");
      return;
    }
    trackProductEvent("tool_meaningful_start", {
      context: kind === "pdf" ? "maker:export_pdf" : "maker:export_docx",
    });
    setBusy(kind);
    try {
      const res = await fetch(`/api/manual-export/${kind}`, {
        signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "resume", content, template, photoDataUrl: photoAllowed ? photoDataUrl || undefined : undefined }),
      });
      // Read the body only after the status check: an error response is JSON,
      // and consuming it as a blob first threw away every message the route
      // sends — "Too many exports", "Invalid resume content", "Invalid resume
      // photo" all surfaced as the same generic failure.
      if (!res.ok) {
        const problem = await res.json().catch(() => ({} as { error?: string }));
        // Machine codes are for code, not for people: map the known gate
        // errors to copy that says what to do next.
        const message = problem.error === "login_required" ? "Please sign in to export DOCX."
          : problem.error === "premium_required" ? "DOCX export requires a Platform Premium plan."
          : errorMessage(problem.error, "Export failed.");
        throw new Error(message);
      }
      const blob = await res.blob();
      downloadBlob(blob, `${name.replace(/[^a-z0-9]+/gi, "_") || "resume"}_resume.${kind}`);
      trackProductEvent("first_value_view", {
        context: kind === "pdf" ? "maker:exported_pdf" : "maker:exported_docx",
      });
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : e.message || "Export failed.");
    } finally {
      setBusy("");
    }
  }

  function renderPreviewRail(modal = false) {
    const fieldPrefix = modal ? "maker-dialog" : "maker-sidebar";
    const inner = (
      <>
        <LivePreview data={previewData} />
        <div className="card sticky-card">
          <div className="row between">
            <h2 className="text-lg font-bold" style={{ margin: 0 }}>Resume readiness</h2>
            <Badge variant={diagnostics.score >= 75 ? "success" : "warning"}>{diagnostics.score}/100</Badge>
          </div>
          <p className="text-[var(--muted-fg)]">{diagnostics.tip}</p>
          <details className="border-y border-[var(--hairline)]">
            <summary className="min-h-11 cursor-pointer content-center py-2 text-sm font-semibold">Target this resume to a job</summary>
            <div className="pb-3">
              <label className="label" htmlFor={`${fieldPrefix}-company-type`}>Target company type</label>
              <select id={`${fieldPrefix}-company-type`} className="field" value={companyType} onChange={(e) => setCompanyType(e.target.value as CompanyType)}>
                {COMPANY_TYPE_KEYS.map((key) => <option value={key} key={key}>{COMPANY_GUIDANCE[key].label}</option>)}
              </select>
              {COMPANY_GUIDANCE[companyType].priorities.map((item) => <p className="text-[13px] text-[var(--muted-fg)]" key={item}>{item}</p>)}
              <label className="label" htmlFor={`${fieldPrefix}-job-description`}>Job description (optional)</label>
              <textarea id={`${fieldPrefix}-job-description`} className="field" value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste the job description for a more specific readiness check." />
              {diagnostics.evidencePrompts.map((prompt) => <p className="text-[13px] text-[var(--muted-fg)]" key={prompt}>{prompt}</p>)}
            </div>
          </details>
          <div className="template-grid" role="group" aria-label="Resume template" style={{ marginTop: 12 }}>
            {TEMPLATES.map((t) => <button key={t} className={`template-card ${template === t ? "selected" : ""}`} onClick={() => setTemplate(t)} type="button" aria-pressed={template === t}><b>{t}</b></button>)}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            {me?.loggedIn && (
              <Button
                variant="outline"
                onClick={() => void saveToAccount()}
                disabled={!!busy}
                isLoading={busy === "save"}
                leftIcon={<Check size={16} />}
                title="Keep this resume in My Resumes — free, no credit used"
              >
                {busy === "save" ? "Saving..." : "Save to My Resumes"}
              </Button>
            )}
            <Button onClick={() => exportFile("pdf")} disabled={!!busy} isLoading={busy === "pdf"} leftIcon={<Download size={16} />}>{busy === "pdf" ? "Exporting..." : "PDF"}</Button>
            {docxAllowed ? (
              <Button variant="outline" onClick={() => exportFile("docx")} disabled={!!busy} isLoading={busy === "docx"} leftIcon={<FileText size={16} />}>
                {busy === "docx" ? "Exporting..." : "DOCX"}
              </Button>
            ) : (
              <Button type="button" disabled variant="outline" title={me?.premiumSource === "student" ? "DOCX export comes with Platform Premium — your Student plan includes clean, watermark-free PDF" : "DOCX is a Premium feature"}>
                <Lock size={16} /> DOCX <span className="text-[13px] text-[var(--muted-fg)]">(Premium)</span>
              </Button>
            )}
          </div>
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      </>
    );
    return modal ? <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{inner}</div> : inner;
  }

  return (
    <ToolShell
      eyebrow="Manual resume maker"
      title="Write your resume"
      subtitle="Fill in each section, check your live preview, then download your resume."
    >
      <div className={`build-grid tool-workspace-grid ${hasPreviewContent ? "has-result" : "is-onboarding"}`} onChangeCapture={markWorkspaceEdited}>
        <section className="card builder-panel">
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
            <div>
              <strong className="text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                {draftStatus === "restored" ? "Device draft restored" : draftStatus === "saved" ? "Draft saved on this device" : "Device-local draft"}
              </strong>
              <p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Form text returns after refresh on this browser for up to 30 days. Photos are never stored in the draft.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmClearDraft(true)}
            >
              Clear saved draft
            </Button>
          </div>
          <div className="section-title"><User size={18} /><h2>Profile</h2></div>
          <div className="maker-market-card">
            <div>
              <label className="label" htmlFor="maker-target-country">Target application country</label>
              <p className="m-0! mt-1! text-[13px] text-[var(--muted-fg)]">Choose the country where the job is located.</p>
            </div>
            <CountryPicker
              id="maker-target-country"
              value={targetCountry?.code || ""}
              includeRules
              onChange={(_code, _name, selectedCountry) => {
                setTargetCountry(selectedCountry);
                setEmployerRequestedPhoto(false);
              }}
            />
          </div>

          <div className={`photo-rule-card photo-rule-${photoPolicy.status}`}>
            <div className="photo-rule-copy">
              <div className="row between">
                <div>
                  <span className="photo-rule-kicker">Resume photo</span>
                  <h3>{targetCountry ? photoPolicy.title : "Choose a country for photo guidance"}</h3>
                </div>
                {photoDataUrl && <NextImage className="photo-thumb" src={photoDataUrl} alt="Selected resume headshot" width={54} height={54} unoptimized />}
              </div>
              <p>{targetCountry ? photoPolicy.guidance : "The photo option follows the application market and stays off by default."}</p>
            </div>

            {targetCountry && photoPolicy.status === "discouraged" && (
              <label className="photo-confirm">
                <input
                  type="checkbox"
                  checked={employerRequestedPhoto}
                  onChange={(event) => setEmployerRequestedPhoto(event.target.checked)}
                />
                <span>The employer or job posting specifically requests a photo</span>
              </label>
            )}

            {targetCountry && photoPolicy.status !== "prohibited" && (
              <div className="row photo-actions">
                <Button as="label" variant="outline" size="compact" className={!photoAllowed ? "cursor-not-allowed opacity-[0.55]" : ""}>
                  <Upload size={15} /> {photoDataUrl ? "Replace photo" : "Add photo"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!photoAllowed}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setErr("");
                      try {
                        setPhotoDataUrl(await prepareResumePhoto(file));
                      } catch (error) {
                        setErr(error instanceof Error ? error.message : "Could not add that photo.");
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                </Button>
                {photoDataUrl && <Button variant="ghost" size="compact" type="button" onClick={() => setPhotoDataUrl("")}><Trash size={14} /> Remove</Button>}
              </div>
            )}
          </div>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <Button as="label" variant="outline" size="compact" isLoading={importing}>
              <Upload size={15} /> {importing ? "Reading profile…" : "Import from LinkedIn"}
              <input
                className="sr-only"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf"
                disabled={importing}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setErr("");
                  setImportNote("");
                  setImporting(true);
                  try {
                    // The upload route already owns size limits, magic-byte
                    // checks and PDF extraction, so the file goes there first.
                    const form = new FormData();
                    form.append("file", file);
                    const uploaded = await fetch("/api/check-resume/upload", { method: "POST", body: form });
                    const uploadJson = await uploaded.json().catch(() => ({}));
                    if (!uploaded.ok) throw new Error(uploadJson?.error || "We could not read that file.");

                    const imported = await fetch("/api/linkedin/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: uploadJson.text }),
                    });
                    const result = await imported.json().catch(() => ({}));
                    if (!imported.ok) throw new Error(result?.detail || "We could not read this export.");

                    const fields = resumeContentToFormFields(result.content as ResumeContent, result.name ?? "");
                    setName(fields.name);
                    setHeadline(fields.headline);
                    setEmail(fields.email);
                    setPhone(fields.phone);
                    setLinkedin(fields.linkedin);
                    setLocation(fields.location);
                    setSummary(fields.summary);
                    setSkills(fields.skills);
                    setEducation(fields.education);
                    setProjects(fields.projects);
                    setCertifications(fields.certifications);
                    setLanguages(fields.languages);
                    setAchievements(fields.achievements);
                    if (fields.experiences.length) {
                      setExperiences(fields.experiences.map((entry) => newExperience(entry)));
                    }
                    const found = (result.found ?? []).join(", ");
                    const warnings = (result.warnings ?? []) as string[];
                    setImportNote(
                      [found ? `Imported ${found}.` : "", ...warnings, "Check every line before exporting."]
                        .filter(Boolean)
                        .join(" "),
                    );
                  } catch (error) {
                    setErr(error instanceof Error ? error.message : "We could not import that profile.");
                  } finally {
                    setImporting(false);
                  }
                }}
              />
            </Button>
            <p className="m-0 max-w-[46ch] text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              On your LinkedIn profile choose <strong>More</strong>, then <strong>Save to PDF</strong>, and upload it here.
              Nothing is invented: only what the export contains is filled in.
            </p>
          </div>
          {importNote && <Notice variant="info" role="status" className="mb-3">{importNote}</Notice>}

          <div className="form-grid">
            <div><label className="label" htmlFor="maker-name">Full name</label><input id="maker-name" autoComplete="name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisha Khan" /></div>
            <div><label className="label" htmlFor="maker-headline">Headline / target title</label><input id="maker-headline" className="field" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Software Engineer" /></div>
            <div><label className="label" htmlFor="maker-email">Email</label><input id="maker-email" autoComplete="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></div>
            <div><label className="label" htmlFor="maker-phone">Phone</label><input id="maker-phone" autoComplete="tel" type="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" /></div>
            <div><label className="label" htmlFor="maker-linkedin">LinkedIn profile</label><input id="maker-linkedin" className="field" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/your-name" /></div>
            <div><label className="label" htmlFor="maker-location">Location</label><input id="maker-location" className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="New York, United States" /></div>
            <div><label className="label" htmlFor="maker-links">Links</label><input id="maker-links" className="field" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="GitHub, portfolio, website" /></div>
          </div>

          <label className="label" htmlFor="maker-summary">Summary</label>
          <textarea id="maker-summary" className="field" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="2-4 lines: role, experience level, strongest tools, and strongest result." />

          <label className="label" htmlFor="maker-skills">Skills</label>
          <textarea id="maker-skills" className="field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="JavaScript, React, Node.js, SQL, AWS, Git" />

          <div className="section-title"><Briefcase size={18} /><h2>Experience</h2></div>
          {experiences.map((exp) => (
            <div className="card soft-card" key={exp.id}>
              <div className="form-grid">
                <div><label className="label" htmlFor={`maker-exp-${exp.id}-role`}>Role</label><input id={`maker-exp-${exp.id}-role`} className="field" value={exp.title} onChange={(e) => updateExp(exp.id, { title: e.target.value })} placeholder="Software Engineer" /></div>
                <div><label className="label" htmlFor={`maker-exp-${exp.id}-company`}>Company</label><input id={`maker-exp-${exp.id}-company`} className="field" value={exp.company} onChange={(e) => updateExp(exp.id, { company: e.target.value })} placeholder="Acme Inc" /></div>
                <div><label className="label" htmlFor={`maker-exp-${exp.id}-start`}>Start</label><input id={`maker-exp-${exp.id}-start`} className="field" value={exp.start} onChange={(e) => updateExp(exp.id, { start: e.target.value })} placeholder="2022" /></div>
                <div><label className="label" htmlFor={`maker-exp-${exp.id}-end`}>End</label><input id={`maker-exp-${exp.id}-end`} className="field" value={exp.end} onChange={(e) => updateExp(exp.id, { end: e.target.value })} placeholder="Present" /></div>
              </div>
              <p className="label">Bullets</p>
              {exp.bullets.map((b, idx) => (
                <input key={idx} aria-label={`Experience bullet ${idx + 1}`} className="field" value={b} onChange={(e) => updateBullet(exp.id, idx, e.target.value)} placeholder="Built reporting dashboard used by 20+ managers, reducing weekly reporting time by 40%" />
              ))}
              <div className="row" style={{ marginTop: 10 }}>
                <Button variant="ghost" size="compact" type="button" onClick={() => updateExp(exp.id, { bullets: [...exp.bullets, ""] })}><Plus size={14} /> Add bullet</Button>
                <Button variant="ghost" size="compact" type="button" onClick={() => setExperiences((rows) => rows.filter((r) => r.id !== exp.id))}><Trash size={14} /> Remove</Button>
              </div>
            </div>
          ))}
          <Button variant="outline" type="button" onClick={() => setExperiences((rows) => [...rows, newExperience({})])}><Plus size={16} /> Add experience</Button>

          <label className="label" htmlFor="maker-education">Education</label>
          <textarea id="maker-education" className="field" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Degree | School | Year | Detail&#10;B.S. Computer Science | State University | 2022 | GPA 3.8" />
          <label className="label" htmlFor="maker-projects">Projects</label>
          <textarea id="maker-projects" className="field" value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="Project name | what it did, tools used, result" />
          <div className="form-grid">
            <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="label mb-0" htmlFor="maker-certifications">Certifications</label><CertificationsPicker value={certifications} onChange={setCertifications} /></div><textarea id="maker-certifications" className="field" value={certifications} onChange={(e) => setCertifications(e.target.value)} placeholder="One per line&#10;AWS Solutions Architect, Associate" /></div>
            <div><label className="label" htmlFor="maker-languages">Languages</label><textarea id="maker-languages" className="field" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi, Spanish" /></div>
          </div>
          <label className="label" htmlFor="maker-achievements">Achievements</label>
          <textarea id="maker-achievements" className="field" value={achievements} onChange={(e) => setAchievements(e.target.value)} placeholder="Won hackathon among 80 teams&#10;Reduced manual reporting by 40%" />
        </section>

        <aside aria-label="Resume preview and export" className="preview-rail">
          {renderPreviewRail()}
        </aside>
      </div>

      <PreviewModal
        visible={Boolean(hasPreviewContent)}
        fabLabel="Open resume preview"
        dialogLabel="Resume preview"
        title="Live preview"
      >
        {() => renderPreviewRail(true)}
      </PreviewModal>

      <div className="text-center mt-6 mb-2">
        <a
          href="/resume-maker/help"
          className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          How to use the manual maker →
        </a>
      </div>

      <FaqSection
        heading="Manual resume builder — common questions"
        headingClassName="text-2xl md:text-3xl"
        faqs={[
          ["Is this resume maker really free?", "Yes. The manual builder is free: structured fields, live preview, ATS readiness scoring, and PDF export. Free users get a small watermark on PDFs; Premium removes the watermark. DOCX export is a Premium feature."],
          ["Is the output ATS-friendly?", "Yes. The maker produces a clean single-column layout with standard headings, no tables, no graphics, and no icons — the format ATS parsers read most reliably."],
          ["How is this different from the AI builder?", "The manual maker gives you full control with no AI involved. The AI builder tailors your content to a specific company, role, and job description and optimizes keywords automatically. Both export the same clean formats."],
          ["Can I switch to the AI builder later?", "Yes. Your details carry the same structure, so you can move to the AI builder any time to tailor the same content to a specific job post."],
        ]}
      />
      {confirmClearDraft && (
        <ConfirmDialog
          title="Clear the saved draft?"
          body="The copy saved on this device is removed. The form you have open right now stays exactly as it is."
          confirmLabel="Clear saved draft"
          destructive
          onConfirm={() => { setConfirmClearDraft(false); clearDraft(); }}
          onCancel={() => setConfirmClearDraft(false)}
        />
      )}
    </ToolShell>
  );
}
