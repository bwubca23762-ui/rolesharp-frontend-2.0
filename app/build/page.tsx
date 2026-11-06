"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Lock, FileText, MessageSquare, Linkedin, Target, Briefcase, User, Check, Upload } from "../icons";
import { statesFor } from "@/lib/locations";
import StepProgress from "@/components/ui/StepWizard";
import CountryPicker from "@/components/ui/CountryPicker";
import ExperienceCards, { newExperience, type ExperienceEntry } from "./experience-cards";
import LivePreview, { type PreviewData } from "./live-preview";
import PreviewFrame from "./preview-frame";
import { buildExamples } from "./examples";
import { atsDiagnostics } from "@/lib/ats-score";
import { scoreHumanAuthenticity } from "@/lib/ai-humanizer";
import { resumeSourceText } from "@/lib/resume-source-text";
import { buildContactLinks, normalizeLinkedinUrl } from "@/lib/contact-links";
import { useToast } from "@/components/ui/Toast";
import SavedResumePicker from "@/components/tools/SavedResumePicker";
import RecommendedJobsCard, { type MatchedJob } from "@/components/RecommendedJobsCard";
import { FaqSection } from "../seo-blocks";
import { useSession } from "../session-context";
import { planLabel } from "@/lib/plan-label";
import { bulletLines, parseEducation, parseProjects, splitList } from "@/lib/resume-form/parse";
import { resumeContentToFormFields } from "@/lib/resume-form/from-resume-content";
import type { ResumeContent } from "@/lib/types";
import { useLocalDraft } from "@/lib/resume-form/use-local-draft";
import { useWorkspacePublisher } from "@/lib/resume-form/use-workspace-publisher";
import { previewText } from "@/lib/resume-form/preview-text";
import { useAutocomplete } from "./use-autocomplete";
import { countryByCode, detectCountry, detectCountryByIp } from "./country-detection";
import { savedCountry } from "@/lib/saved-country";
import PreviewModal from "@/components/ui/PreviewModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CertificationsPicker from "@/components/tools/CertificationsPicker";
import { getCookieConsent } from "@/lib/cookie-consent";
import { trackProductEvent } from "../product-analytics";
import { AtsSealNotice, Badge, Button, GeneratedOutput, Notice } from "@/components/ui/primitives";
import type { AtsSeal } from "@/lib/ats-extract";
import SkillFields from "./skill-fields";
import GenerationReview, { type ReviewRequest, type ReviewSection } from "./generation-review";
// Not @/lib/env: client component, and lib/env.ts parses process.env at module
// scope. lib/limits.ts carries the same defaults with no process access.
import {
  DEFAULT_DAYS_MONTHLY,
  DEFAULT_DAYS_YEARLY,
  DEFAULT_FREE_MONTHLY_LIMIT,
  DEFAULT_PREMIUM_MONTHLY_LIMIT,
  DEFAULT_REFERRAL_MONTHLY_CAP,
} from "@/lib/limits";

// Above lib/request-deadline.ts's LLM_REQUEST_TIMEOUT_MS (90s) on purpose.
// premiumAction shares one budget across three routes and /api/linkedin does
// call the model, so anything at or below 90s would abort a request the server
// was still legitimately working on. /api/generate returns 202 immediately, so
// this is only a ceiling for it, not a wait it is expected to reach.
const TOOL_TIMEOUT_MS = 120_000;

// AEO content for /build — question H2/H3 + 40-60 word direct answers.
const BUILD_FAQS: [string, string][] = [
  ["How do I make a resume for a specific company?", "Pick the company and role, paste the job description, and add your experience. RoleSharp rewrites your resume to match that employer's language and the job's keywords, in the section order recruiters there expect — so a Google resume reads differently from an Amazon one."],
  ["Is RoleSharp's resume builder free?", `Yes. You get ${DEFAULT_FREE_MONTHLY_LIMIT} tailored ${DEFAULT_FREE_MONTHLY_LIMIT === 1 ? "resume" : "resumes"} per rolling month with PDF export, and you earn credits for more by inviting people. A one-time ${DEFAULT_DAYS_MONTHLY}-day or ${DEFAULT_DAYS_YEARLY}-day Premium pass raises the rolling allowance to ${DEFAULT_PREMIUM_MONTHLY_LIMIT}, removes the watermark, and unlocks all templates, cover letters, interview prep, a LinkedIn writer, and DOCX export. Premium never auto-renews.`],
  ["How long does it take to build a resume?", "About eight minutes. The AI drafts your resume from the job description in seconds; the rest is you reviewing and tweaking the wording so it sounds like you. There's a live preview, so you see the final layout as you edit."],
  ["What makes RoleSharp different from other resume builders?", "Most builders give one generic resume. RoleSharp tailors to a named employer and a specific role using the job description, then scores it for ATS compatibility — so each application is sharp for that one job instead of mass-produced."],
  ["Can I download my resume as PDF and Word?", "Yes. PDF export is free on every plan (Premium removes the watermark). DOCX (Word) export is a Premium feature, useful when a portal asks for an editable document or you want to edit in Word."],
  ["Will my resume pass the ATS?", "RoleSharp builds resumes with a single-column, parser-friendly layout, the job's keywords, and quantified bullets — the things applicant tracking systems score. You also get an ATS score on every resume so you can confirm it's ready before you apply."],
  ["Should I send my resume as PDF or DOCX?", "Send the format the posting asks for — that instruction always wins. When both are accepted, a text-based PDF from RoleSharp keeps your layout identical everywhere; choose DOCX when a portal demands an editable file. What breaks parsing is not the format but scans, images, multi-column layouts, and text inside tables."],
];

type Company = { slug: string; name: string; country_code?: string };
type Role = { slug: string; title: string };

type BuildDraft = {
  name: string; email: string; phone: string; city: string; stateRegion: string;
  country: string; countryCode: string; careerLevel: string; linkedin: string;
  links: string; summary: string; skills: string; skillsPerLine?: true; experiences: ExperienceEntry[];
  edu: string; projects: string; certs: string; languages: string;
  achievements: string; jd: string; roleQ: string; companyQ: string; template: string;
};

const TEMPLATES = ["basic", "modern", "compact", "executive", "elegant", "minimal", "technical"];

const BUILD_DRAFT_KEY = "rolesharp-build-draft";
const BUILD_DRAFT_VERSION = 1;
const BUILD_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

function humanize(slug: string) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// Find generated bullets that have NO number/metric. The AI won't invent figures
// (it shouldn't lie), so we nudge the user to add their own — quantified bullets
// are the single biggest thing separating a good resume from a great one.
function unquantifiedBullets(content: any): { exp: string; bullet: string }[] {
  if (!content?.experiences) return [];
  const hasNumber = (s: string) => /\d/.test(s) || /\b(increased|reduced|grew|saved|doubled|tripled)\b/i.test(s);
  const out: { exp: string; bullet: string }[] = [];
  for (const e of content.experiences) {
    for (const b of e.bullets || []) {
      if (!hasNumber(b)) out.push({ exp: `${e.title}${e.company ? " — " + e.company : ""}`, bullet: b });
    }
  }
  return out;
}

function metricPromptIdeas(role: string, company: string) {
  const roleText = role.toLowerCase();
  const prompts = [
    "What percent did you improve, reduce, grow, or speed up?",
    "How many users, customers, tickets, invoices, or projects did you handle?",
    "How much revenue, cost, time, or manual work did this influence?",
    "What team size, market, region, or business unit did your work support?",
  ];
  if (roleText.includes("engineer") || roleText.includes("developer")) {
    prompts.unshift("What page-load, latency, uptime, deployment, bug, or throughput metric improved?");
  } else if (roleText.includes("analyst") || roleText.includes("data")) {
    prompts.unshift("What KPI, forecast accuracy, dashboard usage, or reporting time improved?");
  } else if (roleText.includes("product")) {
    prompts.unshift("What adoption, conversion, retention, launch, or roadmap outcome changed?");
  } else if (roleText.includes("marketing")) {
    prompts.unshift("What CTR, CAC, pipeline, opens, conversions, or ROI changed?");
  } else if (roleText.includes("sales")) {
    prompts.unshift("What quota, pipeline, meetings booked, win rate, or revenue number can you claim?");
  } else if (roleText.includes("accountant") || roleText.includes("finance")) {
    prompts.unshift("How many accounts, closes, reconciliations, audits, or dollars did you own?");
  }
  if (company) prompts.push(`What result would matter most to a recruiter at ${company}? Add that number if you have it.`);
  return prompts.slice(0, 5);
}

export default function Build() {
  const {
    session: me,
    loading: sessionLoading,
    error: sessionError,
    refreshSession: refreshMe,
  } = useSession();
  const authResolved = !sessionLoading;
  const [sourceJobId, setSourceJobId] = useState("");
  const [suggestedJobs, setSuggestedJobs] = useState<MatchedJob[]>([]);
  const [alertState, setAlertState] = useState<"idle" | "enrolling" | "enrolled">("idle");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryConfirmed, setCountryConfirmed] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [city, setCity] = useState(""); const [stateRegion, setStateRegion] = useState("");
  const [linkedin, setLinkedin] = useState(""); const [links, setLinks] = useState(""); const [careerLevel, setCareerLevel] = useState("Fresh graduate");
  const [skills, setSkills] = useState([""]); const [experiences, setExperiences] = useState<ExperienceEntry[]>([]); const [edu, setEdu] = useState("");
  const [projects, setProjects] = useState(""); const [certs, setCerts] = useState(""); const [languages, setLanguages] = useState("");
  const [achievements, setAchievements] = useState(""); const [summary, setSummary] = useState("");
  const [jd, setJd] = useState("");
  const [companyQ, setCompanyQ] = useState(""); const [companyOpen, setCompanyOpen] = useState(false);
  const [company, setCompany] = useState<Company | null>(null); const [companyActive, setCompanyActive] = useState(-1);
  const [roleQ, setRoleQ] = useState(""); const [roleOpen, setRoleOpen] = useState(false); const [roleSel, setRoleSel] = useState<Role | null>(null); const [roleActive, setRoleActive] = useState(-1);
  const [template, setTemplate] = useState("basic");
  const [out, setOut] = useState<any>(null);
  // Bot-Stealth telemetry: the same deterministic scorer the /ai-humanizer
  // studio uses, computed on the generated content. The /build pipeline
  // already runs the de-AI pass server-side, so this badge confirms it.
  const outHumanCheck = useMemo(
    () => (out?.content ? scoreHumanAuthenticity(resumeSourceText(out.content)) : null),
    [out],
  );
  const [extra, setExtra] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  // Double-fire guards: a disabled button alone cannot close the race between
  // click #1 and the re-render (double-tap, fast pointer, assistive tech).
  // The in-flight flags let every money/AI handler no-op a second activation.
  const [upgrading, setUpgrading] = useState(false);
  const [extraBusy, setExtraBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Which fields failed the last submit. Validation here is end-loaded by
  // design — one Generate press — but the reason now renders inside the
  // section that must change (sectionErrors below), and aria-invalid marks
  // the offending fields so a screen reader lands on what to fix.
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  // Per-section validation messages (spec §3.3): the gate reason renders
  // inside the section it belongs to and the form scrolls to it, instead of
  // one aggregate string the user had to map back to fields themselves. The
  // aggregate `err` paragraph keeps only API/network/limit failures.
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  // Bottom-slot coordination (spec §3.10): while the first-visit cookie
  // notice owns the bottom slot, the sticky mobile generate bar stays hidden.
  const [consentPending, setConsentPending] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  // Export seal: the download is fetched so the X-Ats-Seal header can be read
  // and the ATS verdict shown next to the buttons. One export in flight at a
  // time — the same double-fire discipline as the generate button.
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [seal, setSeal] = useState<AtsSeal | null>(null);
  const [importNote, setImportNote] = useState("");
  const { toast } = useToast();
  const companySearchUrl = `/api/companies/search?q=${encodeURIComponent(companyQ)}${countryCode ? `&country=${countryCode}` : ""}`;
  const { results: companies, setResults: setCompanies } = useAutocomplete<Company>({
    query: companyQ,
    url: companySearchUrl,
    minimumLength: 2,
    enabled: !(company && companyQ === company.name),
  });
  const { results: roleList, setResults: setRoleList } = useAutocomplete<Role>({
    query: roleQ,
    url: `/api/roles?q=${encodeURIComponent(roleQ)}`,
    enabled: !(roleSel && roleQ === roleSel.title),
  });

  // Click a preview section → scroll the form to that field + glow it briefly.
  const scrollToFormSection = (section: string) => {
    const id = ["profile", "summary", "skills", "experience", "education", "projects", "extras"].includes(section)
      ? `step-${section}` : `step-${section}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("field-glow");
      setHighlightedSection(section);
      setTimeout(() => { el.classList.remove("field-glow"); setHighlightedSection(null); }, 1600);
    }
  };

  const { status: draftStatus, clear: clearDraft } = useLocalDraft<BuildDraft>({
    key: BUILD_DRAFT_KEY,
    version: BUILD_DRAFT_VERSION,
    maxAgeMs: BUILD_DRAFT_MAX_AGE_MS,
    value: {
      name, email, phone, city, stateRegion, country, countryCode, careerLevel, linkedin,
      links, summary, skills: skills.join("\n"), skillsPerLine: true, experiences, edu, projects, certs, languages, achievements,
      jd, roleQ, companyQ, template,
    },
    onRestore: (draft) => {
      const detected = detectCountry();
      setName(draft.name || ""); setEmail(draft.email || ""); setPhone(draft.phone || "");
      setCity(draft.city || ""); setStateRegion(draft.stateRegion || "");
      setCountry(draft.country || detected?.name || "");
      setCountryCode(draft.countryCode || detected?.code || "");
      setCareerLevel(draft.careerLevel || "Fresh graduate"); setLinkedin(draft.linkedin || "");
      setLinks(draft.links || ""); setSummary(draft.summary || "");
      const restoredSkills = draft.skillsPerLine ? (draft.skills || "").split("\n") : splitList(draft.skills || "");
      setSkills(restoredSkills.length ? restoredSkills : [""]);
      setEdu(draft.edu || "");
      if (Array.isArray(draft.experiences) && draft.experiences.length) {
        setExperiences(draft.experiences.map((e) => newExperience(e)));
      }
      setProjects(draft.projects || ""); setCerts(draft.certs || ""); setLanguages(draft.languages || "");
      setAchievements(draft.achievements || ""); setJd(draft.jd || "");
      if (draft.roleQ) setRoleQ(draft.roleQ); if (draft.companyQ) setCompanyQ(draft.companyQ);
      if (draft.template) setTemplate(draft.template);
      if ((draft.countryCode || detected?.code) && (draft.country || detected?.name)) setCountryConfirmed(true);
    },
  });
  const restored = draftStatus !== "idle";
  // True while mounted — waitForResume checks it so a user navigating away
  // mid-generation doesn't get setState-after-unmount warnings/leaks.
  const aliveRef = useRef(true);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  useEffect(() => {
    setConsentPending(getCookieConsent() === null);
    const clear = () => setConsentPending(false);
    window.addEventListener("rolesharp:cookie-consent", clear);
    return () => window.removeEventListener("rolesharp:cookie-consent", clear);
  }, []);

  // Locale country detection. Fills only what a restored draft left empty, so it
  // can never override the draft's country — the ordering the old inline restore
  // got from its if/else.
  useEffect(() => {
    const detected = detectCountry();
    if (!detected) return;
    setCountry((cur) => cur || detected.name);
    setCountryCode((cur) => cur || detected.code);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      // Public SEO pages pass prefill values in the fragment. Fragments preserve
      // the tailored builder experience without creating thousands of crawlable
      // /build?company=... duplicate URLs. Query params remain supported for
      // payment/auth callbacks and old links.
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const prefill = (key: string) => params.get(key) ?? fragment.get(key);
      if (params.get("paid")) setTimeout(refreshMe, 1500);
      const companySlug = prefill("company");
      if (companySlug) {
        // Slug may be country-prefixed (us-google) or a bare name (google); show
        // a clean display name either way, keep the slug as the identity.
        const display = humanize(companySlug.replace(/^[a-z]{2}-/, ""));
        setCompany({ slug: companySlug, name: display }); setCompanyQ(display);
      }
      const roleSlug = prefill("role");
      if (roleSlug) { setRoleSel({ slug: roleSlug, title: humanize(roleSlug) }); setRoleQ(humanize(roleSlug)); }
      // country=US from the homepage geo banner / SEO pages — map code → name.
      const cParam = prefill("country");
      if (cParam) {
        countryByCode(cParam).then((match) => {
          if (match) { setCountry(match.name); setCountryCode(match.code); }
        });
      } else {
        // No link context: fall back to the market the user confirmed anywhere
        // on the site (first-visit prompt / jobs picker) so the builder agrees
        // with the checker and fixer instead of defaulting to nothing.
        const saved = savedCountry();
        if (saved?.code) {
          countryByCode(saved.code).then((match) => {
            if (match) { setCountry(match.name); setCountryCode(match.code); }
          });
        }
      }
      // ?resumeId= (also accepted in the fragment): load a saved resume on
      // arrival — the /resumes/[id] and dashboard "Edit" buttons land here.
      const resumeIdParam = prefill("resumeId");
      if (resumeIdParam && /^[0-9a-f-]{36}$/i.test(resumeIdParam)) {
        void loadSavedResumeRef.current(resumeIdParam);
      }
      const jobId = prefill("jobId");
      if (jobId && /^[0-9a-f-]{36}$/i.test(jobId)) {
        setSourceJobId(jobId);
        fetch(`/api/jobs/${jobId}`)
          .then((response) => response.ok ? response.json() : Promise.reject())
          .then(({ job }) => {
            setCompany(null); setCompanyQ(job.company || "");
            setRoleSel(null); setRoleQ(job.title || "");
            setJd(job.description || "");
            return countryByCode(job.country_code).then((match) => {
              if (match) { setCountry(match.name); setCountryCode(match.code); setCountryConfirmed(true); }
            });
          })
          .catch(() => setErr("That job listing is no longer available. You can still enter the role manually."));
      }
    }
  }, [refreshMe]);

  // Accurate IP-based country (Cloudflare /api/geo). Only fills if nothing is set
  // yet (no draft, no URL param, no locale match) so a US visitor never inherits
  // an India default. Never overrides a country the user already picked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ip = await detectCountryByIp();
      if (!cancelled && ip) setCountry((cur) => {
        if (cur) return cur;
        setCountryCode(ip.code);
        return ip.name;
      });
    })();
    return () => { cancelled = true; };
  }, []);

  function clearForm() {
    clearDraft();
    setName(""); setEmail(""); setPhone(""); setCity(""); setStateRegion("");
    setCareerLevel("Fresh graduate"); setLinkedin(""); setLinks(""); setSummary(""); setSkills([""]); setExperiences([]); setEdu("");
    setProjects(""); setCerts(""); setLanguages(""); setAchievements(""); setJd("");
    setRoleQ(""); setRoleSel(null); setCompanyQ(""); setCompany(null); setTemplate("basic");
    setOut(null); setErr("");
    setImportNote("");
  }

  // Apply parsed resume content onto the form. Non-empty current values win:
  // a load must refine, never silently overwrite what the user already typed.
  function applyResumeFields(content: ResumeContent, candidateName: string) {
    const fields = resumeContentToFormFields(content, candidateName);
    if (fields.name && !name.trim()) setName(fields.name);
    if (!email.trim()) setEmail(fields.email);
    if (fields.phone && !phone.trim()) setPhone(fields.phone);
    if (fields.linkedin && !linkedin.trim()) setLinkedin(fields.linkedin);
    if (fields.summary && !summary.trim()) setSummary(fields.summary);
    if (content.skills?.length && !skills.some((skill) => skill.trim())) setSkills(content.skills);
    if (fields.education && !edu.trim()) setEdu(fields.education);
    if (fields.projects && !projects.trim()) setProjects(fields.projects);
    if (fields.certifications && !certs.trim()) setCerts(fields.certifications);
    if (fields.languages && !languages.trim()) setLanguages(fields.languages);
    if (fields.achievements && !achievements.trim()) setAchievements(fields.achievements);
    if (fields.experiences.length) {
      setExperiences(fields.experiences.map((entry) => newExperience(entry)));
    }
  }

  // Saved-resume pathway: pull a previously generated resume straight from the
  // database and apply its structured content to the form (no re-parse), and
  // restore it as the active output so PDF/DOCX export and premium actions
  // keep working on the loaded resume.
  async function loadSavedResume(resumeId: string) {
    setErr("");
    try {
      const r = await fetch(`/api/resume/${resumeId}`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error === "login_required" ? "Please log in again to load that resume." : "Could not load that resume.");
      applyResumeFields(j.content as ResumeContent, j.candidateName ?? "");
      setOut({ resumeId: j.id ?? resumeId, content: j.content, atsScore: j.atsScore, premiumUnlock: j.premiumUnlock, creditUsed: false });
      toast("Resume loaded into the builder.", "success");
    } catch (e: any) {
      setErr(e?.message || "Could not load that resume.");
    }
  }

  async function fetchJobSuggestions() {
    const role = roleQ.trim();
    if (role.length < 2) return;
    fetch(`/api/jobs/suggest?role=${encodeURIComponent(role)}&country=${encodeURIComponent(countryCode || "US")}`)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((data) => {
        if (Array.isArray(data.jobs)) setSuggestedJobs(data.jobs);
      })
      .catch(() => {});
  }

  // Stable handle for success paths deep inside generate().
  const fetchJobSuggestionsRef = useRef(fetchJobSuggestions);
  fetchJobSuggestionsRef.current = fetchJobSuggestions;
  // Stable handle so the one-shot mount effect can trigger the freshest
  // closure for /build?resumeId=... without re-running the effect.
  const loadSavedResumeRef = useRef(loadSavedResume);
  loadSavedResumeRef.current = loadSavedResume;

  // Upload an existing resume (any template) and let the parser restructure it
  // into the builder's labelled fields. Premium fills every field; free users
  // get a parse preview plus the upgrade path.
  async function importResumeFile(file: File) {
    setErr("");
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await fetch("/api/check-resume/upload", { method: "POST", body: form });
      const uploadJson = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok) throw new Error(uploadJson?.error || "We could not read that file.");

      const imported = await fetch("/api/resume/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: uploadJson.text }),
      });
      const result = await imported.json().catch(() => ({}));
      if (!imported.ok) throw new Error(result?.detail || "We could not read this resume.");

      if (result.premiumRequired) {
        const sample = (result.preview?.skillsSample ?? []).join(", ");
        const role = result.preview?.latestRole;
        setImportNote(
          [
            `We found ${result.found.join(", ") || "no sections"}.`,
            role ? `Latest role: ${role.title}${role.company ? ` at ${role.company}` : ""}.` : "",
            sample ? `Skills spotted: ${sample}.` : "",
            `Upgrade to Premium to pull all of it straight into the builder.`,
          ].filter(Boolean).join(" "),
        );
        return;
      }

      applyResumeFields(result.content as ResumeContent, result.name ?? "");
      const found = (result.found ?? []).join(", ");
      const warnings = (result.warnings ?? []) as string[];
      setImportNote(
        [found ? `Imported ${found}.` : "", ...warnings, "Check every line before generating."]
          .filter(Boolean)
          .join(" "),
      );
      trackProductEvent("tool_meaningful_start", { context: "builder:resume_imported", authState: me?.loggedIn ? "authenticated" : "anonymous" });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "We could not import that resume.");
    } finally {
      setImporting(false);
    }
  }
  useEffect(() => { setRoleActive(-1); }, [roleList]);
  useEffect(() => { setCompanyActive(-1); }, [companies]);

  const premium = me?.premium;
  // DOCX is a tier feature (Platform Premium only — students deliberately
  // excluded, lib/tier-features.ts). Credit/unlock exports stay available to
  // FREE accounts; they must not re-open DOCX for the student tier.
  const docxAllowed = !!me?.features?.docxExport;
  const credits = Number(me?.credits ?? 0);
  const canSpendCredit = !premium && Number(me?.remaining ?? 0) <= 0 && credits > 0;
  const premiumForOutput = premium || !!out?.premiumUnlock || !!out?.creditUsed;
  const docxForOutput = docxAllowed || (!premium && (!!out?.premiumUnlock || !!out?.creditUsed));
  const docxLockedMessage = me?.premiumSource === "student"
    ? "DOCX export comes with Platform Premium — your Student plan includes clean, watermark-free PDF."
    : "DOCX is a Premium feature. Use 1 credit after your free rolling allowance or add a Premium pass.";
  const premiumTemplateUnlocked = premium || canSpendCredit;
  // Structured experiences → schema entries (only cards with a title/company or
  // at least one non-empty bullet; current role => end "Present").
  const expEntries = useMemo(() =>
    experiences
      .map((e) => ({
        title: e.title.trim() || (careerLevel.includes("Fresh") ? "Experience" : "Experience"),
        company: e.company.trim(),
        location: e.location.trim(),
        start: e.start.trim(),
        end: e.current ? "Present" : e.end.trim(),
        bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
        impactFacts: {
          metric: e.impactFacts.metric.trim() || undefined,
          scope: e.impactFacts.scope.trim() || undefined,
          outcome: e.impactFacts.outcome.trim() || undefined,
          timeframe: e.impactFacts.timeframe.trim() || undefined,
        },
      }))
      .filter((e) => e.company || e.bullets.length > 0),
  [experiences, careerLevel]);

  const listedSkills = useMemo(() => skills.map((skill) => skill.trim()).filter(Boolean), [skills]);
  const hasSkills = listedSkills.length > 0;

  const completeness = useMemo(() => {
    const hasMeasuredEvidence = expEntries.some((experience) =>
      experience.bullets.some((bullet) => /\d|%|\$|₹/.test(bullet)) ||
      Boolean(experience.impactFacts.metric || experience.impactFacts.scope || experience.impactFacts.outcome),
    ) || parseProjects(projects).some((project) => /\d|%|\$|₹/.test(project.detail));
    const checks = [
      !!name.trim(), !!(email.trim() || phone.trim()), !!country.trim(), !!city.trim(), !!roleQ.trim(),
      hasSkills, parseEducation(edu).length > 0,
      expEntries.length > 0 || parseProjects(projects).length >= 2,
      !!jd.trim(), !!summary.trim(), !!(linkedin.trim() || splitList(links).length), hasMeasuredEvidence,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [name, email, phone, country, city, roleQ, hasSkills, edu, expEntries, projects, jd, summary, linkedin, links]);

  // Live preview model — mirrors what the resume will contain, updated as you type.
  const previewData: PreviewData = useMemo(() => ({
    name: name.trim(),
    role: roleSel?.title || roleQ.trim(),
    company: company?.name || companyQ.trim(),
    email: email.trim(),
    phone: phone.trim(),
    linkedin: linkedin.trim() ? normalizeLinkedinUrl(linkedin) : "",
    location: [city.trim(), stateRegion.trim(), country].filter(Boolean).join(", "),
    links: buildContactLinks(linkedin, splitList(links)).filter((link) => !/linkedin\.com\/in\//i.test(link)),
    summary: summary.trim(),
    skills: listedSkills,
    experiences,
    education: parseEducation(edu),
    projects: parseProjects(projects),
    certifications: bulletLines(certs),
    languages: splitList(languages),
    achievements: bulletLines(achievements),
  }), [name, roleSel, roleQ, company, companyQ, email, phone, linkedin, city, stateRegion, country, links, summary, listedSkills, experiences, edu, projects, certs, languages, achievements]);

  const markWorkspaceEdited = useWorkspacePublisher({ resumeText: previewText(previewData), jdText: jd, targetRole: previewData.role, targetCompany: previewData.company }, "build");

  // Live ATS estimate — same scorer the engine uses, run on the in-progress form.
  // Climbs as the user adds detail/metrics, turning effort into a visible payoff.
  const liveAts = useMemo(() => {
    const content: any = {
      headline: previewData.role || roleQ.trim() || name.trim(),
      contact: { email: previewData.email, phone: previewData.phone, linkedin: previewData.linkedin, location: previewData.location, links: previewData.links },
      summary: previewData.summary,
      skills: previewData.skills,
      experiences: (previewData.experiences || []).map((e: any) => {
        const impact = [e.impactFacts?.metric, e.impactFacts?.outcome, e.impactFacts?.scope, e.impactFacts?.timeframe]
          .filter(Boolean)
          .join(", ");
        const bullets = (e.bullets || []).filter(Boolean).map((bullet: string, index: number) =>
          index === 0 && impact && !/\d|%|\$|₹/.test(bullet) ? `${bullet} (${impact})` : bullet,
        );
        return {
          title: e.title || "", company: e.company || "",
          period: [e.start, e.current ? "Present" : e.end].filter(Boolean).join("–"),
          bullets,
        };
      }),
      education: previewData.education || [],
      projects: previewData.projects || [],
      certifications: previewData.certifications || [],
      languages: previewData.languages || [],
      achievements: previewData.achievements || [],
    };
    const hasAny = name.trim() && (previewData.skills.length || content.experiences.length || (previewData.education || []).length);
    if (!hasAny) return null;
    // Context-aware scoring: without the target role and the candidate's own
    // skills the meter stripped 16-26 points (searchability -3, hard skills -7,
    // coverage -6) that the generated resume would earn — the draft-vs-final
    // collapse. headline already carries the role; pass both explicitly.
    const targetRoleTitle = roleQ.trim() || previewData.role || "";
    const diagnostics = atsDiagnostics(jd.trim(), content, {
      targetRole: targetRoleTitle,
      targetCompany: company?.name || companyQ.trim() || undefined,
      roleSkills: previewData.skills,
    });
    const exactRoleMatch = !!roleQ.trim() && content.headline.toLowerCase().includes(roleQ.trim().toLowerCase());
    const prompts = [...diagnostics.evidencePrompts];
    if (!exactRoleMatch) prompts.unshift(`Use the exact target title "${roleQ.trim()}" in your headline.`);
    return { ...diagnostics, exactRoleMatch, evidencePrompts: prompts.slice(0, 4) };
  }, [previewData, jd, roleQ, name, company, companyQ]);

  const hasPreviewContent = useMemo(() => {
    return (
      !!out?.content ||
      !!name.trim() ||
      hasSkills ||
      parseEducation(edu).length > 0 ||
      expEntries.length > 0 ||
      parseProjects(projects).length > 0
    );
  }, [out, name, hasSkills, edu, expEntries, projects]);

  function scrollToStep(section: string) {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`step-${section}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function reviewDetails() {
    if (busy) return;
    setErr("");
    // Each gate reports which wall it is before turning the user away. These
    // returns sit above tool_meaningful_start, so without them a blocked
    // attempt looks identical to never having tried. Contexts are written out
    // as literals rather than built from a variable: they name the gate only,
    // never the field contents, and a literal is the version a reader and a
    // test can both confirm at a glance. The reason itself renders inline in
    // the section that must change, and the form scrolls to it.
    const authState = me?.loggedIn ? "authenticated" : "anonymous";
    if (!countryConfirmed) {
      trackProductEvent("tool_start_blocked", { context: "builder:country_unconfirmed", authState });
      setInvalid(new Set(["country"]));
      setSectionErrors({ target: "Confirm your country first so the resume matches your local hiring market." });
      scrollToStep("target"); return;
    }
    if (!name.trim() || !roleQ.trim()) {
      trackProductEvent("tool_start_blocked", { context: "builder:missing_name_or_role", authState });
      setInvalid(new Set([...(!name.trim() ? ["name"] : []), ...(!roleQ.trim() ? ["role"] : [])]));
      const errors: Record<string, string> = {};
      if (!name.trim()) errors.profile = "Add your full name in the Profile section.";
      if (!roleQ.trim()) errors.target = "Add the target role you are applying for.";
      setSectionErrors(errors);
      scrollToStep(!name.trim() ? "profile" : "target"); return;
    }
    if (!edu.trim() && expEntries.length === 0 && !projects.trim()) {
      trackProductEvent("tool_start_blocked", { context: "builder:no_history", authState });
      setInvalid(new Set(["history"]));
      setSectionErrors({ evidence: "Add education, experience, or projects before generating. Empty resumes will not pass ATS checks." });
      scrollToStep("evidence"); return;
    }
    setInvalid(new Set());
    setSectionErrors({});
    const profile = {
      name: name.trim(), email: email.trim(), phone: phone.trim(), country,
      linkedin: linkedin.trim() ? normalizeLinkedinUrl(linkedin) : undefined,
      location: [city.trim(), stateRegion.trim(), country].filter(Boolean).join(", "),
      links: buildContactLinks(linkedin, splitList(links)).filter((link) => !/linkedin\.com\/in\//i.test(link)),
      careerLevel,
      summary: summary.trim(),
      skills: listedSkills,
      experiences: expEntries,
      education: parseEducation(edu),
      projects: parseProjects(projects),
      certifications: bulletLines(certs),
      languages: splitList(languages),
      achievements: bulletLines(achievements),
    };
    setReviewRequest({
      profile,
      companySlug: company?.slug,
      companyNameRaw: company ? undefined : companyQ.trim() || undefined,
      roleSlug: roleSel?.slug,
      roleTitleRaw: roleSel ? undefined : roleQ.trim() || undefined,
      jdText: jd,
      template,
    });
  }

  function editReviewedSection(section: ReviewSection) {
    setReviewRequest(null);
    const fieldId = { profile: "bp-name", target: "bp-role", evidence: "bp-skills", extras: "bp-certs" }[section];
    requestAnimationFrame(() => {
      document.getElementById(fieldId)?.focus({ preventScroll: true });
      scrollToStep(section);
    });
  }

  async function generate() {
    if (busy || !reviewRequest) return;
    setReviewRequest(null);
    setSuggestedJobs([]);
    trackProductEvent("tool_meaningful_start", {
      context: "builder:generate",
      authState: me?.loggedIn ? "authenticated" : "anonymous",
    });
    setBusy(true); setOut(null); setExtra(null);
    try {
      const res = await fetch("/api/generate", {
        signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewRequest),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.status === 402) {
        const j = await res.json().catch(() => ({}));
        // email_not_verified rides the same 402 as a spent allowance — without
        // this branch a fresh user with 3 free resumes is told to pay up.
        if (j.error === "email_not_verified") {
          setErr(`Please verify your email address (we sent a link to ${j.email || "your inbox"}) before generating a resume.`);
          return;
        }
        setErr(j.premium
          ? `You've reached your ${j.limit ?? DEFAULT_PREMIUM_MONTHLY_LIMIT} resumes in this rolling month.`
          : `You've used your ${j.limit ?? DEFAULT_FREE_MONTHLY_LIMIT} free resumes in this rolling month. Invite friends (max ${DEFAULT_REFERRAL_MONTHLY_CAP} credits per rolling month) or add a Premium pass to keep going.`);
        return;
      }
      if (res.status === 429) {
        // /api/generate rate limits at 8. Without this the fallthrough said
        // "Generation failed", which reads as a bug rather than "wait a moment".
        const retry = Number(res.headers.get("Retry-After"));
        setErr(Number.isFinite(retry) && retry > 0
          ? `Too many generations right now. Try again in about ${retry} seconds.`
          : "Too many generations right now. Please wait a moment and try again.");
        return;
      }
      if (res.status === 503) { setErr("High traffic — retry in about 30 seconds."); return; }
      const j = await res.json();
      if (j.content) {
        setOut(j);
        // Failures announce via role="alert"; completion announced nothing, so
        // a screen-reader user sat through the ~90s wait with no signal. The
        // toast stack is already role="status" aria-live="polite".
        toast("Resume ready. Your tailored resume is below.", "success");
        trackProductEvent("first_value_view", {
          context: "builder:generated_resume",
          authState: "authenticated",
        });
        void fetchJobSuggestionsRef.current();
        refreshMe();
      } else if (res.status === 202 && j.resumeId) {
        const ready = await waitForResume(j.resumeId);
        if (ready?.content) {
          setOut({ resumeId: j.resumeId, content: ready.content, atsScore: ready.atsScore, premiumUnlock: j.premiumUnlock, creditUsed: j.creditUsed });
          toast("Resume ready. Your tailored resume is below.", "success");
          trackProductEvent("first_value_view", {
            context: "builder:generated_resume",
            authState: "authenticated",
          });
          void fetchJobSuggestionsRef.current();
          refreshMe();
        } else if (ready?.error === "generation_failed") {
          setErr("Generation failed. Your slot was released — please try again.");
        } else if (ready?.error === "not_found") {
          setErr("Resume not found or you don't have access to it. Try generating again.");
        } else {
          setErr("Still processing. Check My resumes in a minute or try again.");
        }
      } else setErr("Generation failed. Try again.");
    } catch (e: any) {
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : String(e));
    } finally { setBusy(false); }
  }

  async function enrollWeeklyAlert() {
    if (alertState !== "idle") return;
    setAlertState("enrolling");
    try {
      const r = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKeyword: roleQ.trim().slice(0, 60), countryCode: countryCode || "US", frequency: "weekly" }),
      });
      if (r.ok) setAlertState("enrolled");
      else setAlertState("idle");
    } catch {
      setAlertState("idle");
    }
  }

  async function waitForResume(resumeId: string) {
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, i < 6 ? 2500 : 5000));
      // Stop polling (and state updates) once the component unmounts.
      if (!aliveRef.current) return null;
      const r = await fetch(`/api/resume/${resumeId}`).catch(() => null);
      if (!aliveRef.current) return null;
      if (r?.ok) return r.json();
      if (r?.status === 401) { window.location.href = "/login"; return null; }
      if (r?.status === 403) return { error: "not_found" };
      // The route reports a permanently failed generation (its idempotency
      // claim is 'failed', no resume row will ever appear) — stop immediately.
      if (r?.status === 422) return { error: "generation_failed" };
      // 404 means the background generation worker has not committed the row
      // yet (LLM inference + schema parse can take 10-30s) — keep polling
      // until the retries above are exhausted. Only 403 (someone else's
      // resume) terminates early.
    }
    return null;
  }

  async function upgrade(plan: "monthly" | "yearly" = "monthly") {
    if (upgrading) return;
    setErr("");
    setUpgrading(true);
    const checkoutPath = `/settings?tab=billing&plan=${plan}`;
    // Let a buyer choose Card/UPI or crypto at the one shared, secure payment
    // surface. Sending the highest-intent Builder CTA directly to crypto was
    // silently excluding the site's primary INR payment method.
    try {
      trackProductEvent("checkout_intent", { context: `builder:${plan}`, authState: me?.loggedIn ? "authenticated" : "anonymous" });
      window.location.href = me?.loggedIn ? checkoutPath : `/login?next=${encodeURIComponent(checkoutPath)}`;
    // This action only navigates; unlike the old crypto-invoice call, it
    // cannot create a second payment. Always release the visual lock if a
    // browser blocks or delays navigation.
    } finally { setUpgrading(false); }
  }

  async function premiumAction(kind: "cover" | "interview" | "linkedin") {
    if (!out?.resumeId || extraBusy) return; // one click, one premium action
    setExtraBusy(true);
    setExtra({ kind, text: "Generating..." });
    try {
      const res = await fetch(`/api/${kind}`, { signal: AbortSignal.timeout(TOOL_TIMEOUT_MS), method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId: out.resumeId }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) {
        setExtra(null);
        setErr(res.status === 502 ? "The AI is busy right now. Please try again in a moment." : `${kind} is a Premium feature. Upgrade to unlock.`);
        return;
      }
      if (kind === "interview") setExtra({ kind, text: (j.interview?.items || []).map((it: any, i: number) => `Q${i + 1}. ${it.q}\n${it.a}`).join("\n\n") });
      else setExtra({ kind, text: j.coverLetter || j.linkedin });
    } catch (e: any) {
      setExtra(null);
      setErr(e?.name === "TimeoutError" ? "That took too long. Please try again." : "Network error. Please try again.");
    } finally { setExtraBusy(false); }
  }

  // Fetched export: the seal rides the X-Ats-Seal response header, so the
  // download goes through fetch instead of plain navigation. The anchor href
  // stays on the button (and the e2e pins) as the no-JS fallback.
  async function downloadResume(kind: "pdf" | "docx") {
    if (!out?.resumeId || exporting) return; // one export in flight
    setExporting(kind); setSeal(null);
    try {
      const res = await fetch(`/api/resume/${out.resumeId}/${kind}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setErr("Could not export right now. Please try again in a moment."); return; }
      const sealValue = res.headers.get("X-Ats-Seal");
      if (sealValue) {
        try { setSeal(JSON.parse(decodeURIComponent(sealValue)) as AtsSeal); }
        catch { /* the seal is additive — never block the download on it */ }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(name || "resume").replace(/[^a-z0-9]+/gi, "_")}_resume.${kind}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Could not export right now. Please try again in a moment.");
    } finally { setExporting(null); }
  }

  // While auth state is unknown, hold a stable, reserved-height frame so the
  // page doesn't render the full builder optimistically and then collapse to
  // the login card (that swap caused a CLS of ~0.9). Both the loading and
  // logged-out states share the same centered shell, so the shift is ~0.
  if (!authResolved || me === null) {
    return (
      <main>
        <div className="container center" style={{ maxWidth: 480 }}>
          <div className="card" style={{ marginTop: 50 }}>
            <h1 style={{ fontSize: "1.6rem" }}>Build a resume tailored to the job</h1>
            <p className="text-[var(--muted-fg)]">Getting your workspace ready.</p>
          </div>
        </div>
        <FaqSection heading="Resume builder — common questions" faqs={BUILD_FAQS} />
      </main>
    );
  }

  if (sessionError) {
    return (
      <main>
        <div className="container center" style={{ maxWidth: 520 }}>
          <div className="card" style={{ marginTop: 50 }}>
            <h1 style={{ fontSize: "1.6rem" }}>Your workspace could not load</h1>
            <p className="text-[var(--muted-fg)]">{sessionError}</p>
            <Button onClick={() => void refreshMe()} fullWidth>
              Try again
            </Button>
          </div>
        </div>
        <FaqSection heading="Resume builder — common questions" faqs={BUILD_FAQS} />
      </main>
    );
  }

  if (!me.loggedIn) {
    return (
      <main>
        <section className="desk-tool-header border-b border-[var(--hairline)]">
          <div style={{ margin: "0 auto", maxWidth: "var(--maxw)", width: "calc(100% - 2rem)" }} className="py-6 md:py-8">
            <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.35rem)] font-extrabold! leading-[1.08]! tracking-[-0.03em]! text-[var(--fg)]">Build a resume tailored to the job</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted-fg)]">Sign in to save your work. Then choose a target role, add evidence from your experience, and review the draft before exporting.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button as="a" variant="primary" size="lg" href={`/login?next=${encodeURIComponent(sourceJobId ? `/build?jobId=${sourceJobId}` : "/build")}`}>Log in / Sign up</Button>
              <Button as="a" variant="outline" size="lg" href="/checker">Try the free ATS checker first</Button>
            </div>
          </div>
        </section>
        <FaqSection heading="Resume builder — common questions" faqs={BUILD_FAQS} />
      </main>
    );
  }

  const mo = me?.plans?.find((p: any) => p.id === "monthly");
  const yr = me?.plans?.find((p: any) => p.id === "yearly");
  const save = mo && yr ? Math.round((1 - yr.price / (mo.price * 12)) * 100) : 0;
  // Country- + role-aware placeholder examples (replaces hardcoded India samples).
  const ex = buildExamples(country, roleQ);
  const metricIdeas = metricPromptIdeas(roleQ, company?.name || companyQ.trim());

  return (
    <main className="container build-shell desk-builder">
      <section className="border-b border-[var(--hairline)]">
        <div style={{ margin: "0 auto", maxWidth: "var(--maxw)", width: "calc(100% - 2rem)" }} className="py-6 md:py-8">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold! leading-[1.1]! tracking-[-0.035em]! text-[var(--fg)]">Tailor a resume</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-fg)]">Choose a target role, add evidence from your experience, and review the draft before exporting.</p>
        </div>
      </section>
      <div className="tierbar">
        <div className="row" style={{ gap: 8 }}>
          <Badge variant={premium ? "premium" : "default"}>{planLabel(me)}</Badge>
          <span className="text-[var(--muted-fg)]" style={{ fontSize: 14 }}>{premium ? `${me?.remaining ?? "-"}/${me?.limit ?? 10} resumes left in this rolling month` : `${me?.remaining ?? "-"}/${me?.limit ?? 3} free left in this rolling month`}</span>
          <Badge variant="premium">{credits} credits</Badge>
          <Badge variant="premium">Profile {completeness}%</Badge>
        </div>
        {!premium && (
          <div className="row">
            {/* outline + primary: these are purchase CTAs, not navigation.
                Ghost read as "maybe later" controls and got ignored. */}
            <Button variant="outline" onClick={() => upgrade("monthly")} disabled={upgrading} isLoading={upgrading}>{mo?.days ?? 30}-day pass — ${mo?.price ?? 12} once</Button>
            <Button onClick={() => upgrade("yearly")} disabled={upgrading} isLoading={upgrading} className="rsx-glow">{yr?.days ?? 365}-day pass — ${yr?.price ?? 79} once — save {save}%</Button>
          </div>
        )}
      </div>
      {!premium && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] my-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
            {canSpendCredit ? "0 free left" : `${me?.remaining ?? 3}/${me?.limit ?? 3} free in this rolling month`}
          </span>
          {!canSpendCredit && (
            <>
              <span>Need more? <a href="/settings?tab=credits" className="font-semibold underline">Earn credits</a>.</span>
              <span>Or <button type="button" className="link-btn font-semibold" onClick={() => upgrade("yearly")}>add Premium access</button> for the higher rolling allowance and Premium tools.</span>
            </>
          )}
        </div>
      )}

      {!countryConfirmed && (
        <section className="country-gate">
          <div>
            <h2>Where are you applying?</h2>
            <p className="m-0! leading-[1.6] text-[var(--muted-fg)]">Resume rules differ by country. Set yours once and the layout follows.</p>
          </div>
          <div className="country-actions">
            <CountryPicker value={countryCode} onChange={(code, name) => { setCountryCode(code); setCountry(name); }} />
            <Button onClick={() => setCountryConfirmed(true)} disabled={!countryCode}><Check size={16} /> Continue</Button>
          </div>
        </section>
      )}

      {countryConfirmed && (() => {
        const profileDone = !!name.trim() && !!(email.trim() || phone.trim()) && !!city.trim();
        const targetDone = !!roleQ.trim();
        const evidenceDone = hasSkills && (parseEducation(edu).length > 0 || expEntries.length > 0 || parseProjects(projects).length > 0);
        const stepCurrent = !profileDone ? 0 : !targetDone ? 1 : !evidenceDone ? 2 : out ? 4 : 3;
        // Scroll to a section. This used to also fire a "Draft saved" toast on
        // every click, unconditionally — the draft is autosaved on a debounce by
        // useLocalDraft whether or not anything was touched, so the toast
        // credited a background timer to whatever the user had just clicked and
        // claimed a save had happened even when nothing had changed. Draft state
        // is already reported by draftStatus; navigation should not announce it.
        const jump = (i: number) => {
          const id = ["step-profile", "step-target", "step-evidence", "step-generate", "step-export"][i];
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
        };
        return (
          <div className="build-steps">
            <StepProgress steps={["Profile", "Target job", "Evidence", "Generate", "Export"]} current={stepCurrent} onJump={jump} />
          </div>
        );
      })()}

      <div className="build-grid" onChangeCapture={markWorkspaceEdited}>
        <section className="card builder-panel">
          <div className="section-title" id="step-profile"><User size={18} /><h2>Profile</h2></div>
          {sectionErrors.profile && <p id="build-error-profile" className="err" role="alert">{sectionErrors.profile}</p>}
          <SavedResumePicker onSelect={(id) => void loadSavedResume(id)} />
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <Button as="label" variant="outline" size="compact" className={importing ? "cursor-not-allowed opacity-[0.55]" : ""}>
              <Upload size={15} /> {importing ? "Reading resume…" : "Import from existing resume"}
              <input
                className="sr-only"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf"
                disabled={importing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) importResumeFile(file);
                }}
              />
            </Button>
            <p className="m-0 max-w-[52ch] text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              Upload a PDF, DOCX or TXT resume in any format and we restructure it into these fields.
              Premium pulls every section across; free shows you what we found first.
            </p>
          </div>
          {importNote && <Notice variant="info" role="status" className="mb-3">{importNote}</Notice>}
          <div className="form-grid">
            <div><label className="label" htmlFor="bp-name">Full name <span style={{ color: "var(--danger)" }}>*</span></label><input id="bp-name" className="field" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setInvalid((c) => { if (!c.has("name")) return c; const n = new Set(c); n.delete("name"); return n; }); setSectionErrors((c) => { if (!c.profile) return c; const next = { ...c }; delete next.profile; return next; }); }} placeholder={ex.name} required aria-required="true" aria-invalid={invalid.has("name") || undefined} aria-errormessage={invalid.has("name") ? "build-error-profile" : undefined} /></div>

            <div><label className="label" htmlFor="bp-career-level">Career level</label><select id="bp-career-level" className="field" value={careerLevel} onChange={(e) => setCareerLevel(e.target.value)}><option>Fresh graduate</option><option>Student</option><option>Intern</option><option>Experienced</option><option>Career changer</option></select></div>
            <div><label className="label" htmlFor="bp-email">Email</label><input id="bp-email" className="field" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></div>
            <div><label className="label" htmlFor="bp-phone">Phone</label><input id="bp-phone" className="field" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={ex.phone} /></div>
            <div><label className="label" htmlFor="bp-linkedin">LinkedIn profile</label><input id="bp-linkedin" className="field" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/your-name" /></div>
            <div><label className="label" htmlFor="bp-city">City</label><input id="bp-city" className="field" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder={ex.city} /></div>
            <div>
              <label className="label" htmlFor="bp-state">State / Region</label>
              <input id="bp-state" className="field" list="state-options" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} placeholder="Start typing or pick your state" autoComplete="off" />
              <datalist id="state-options">
                {statesFor(countryCode).map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <span className="label" id="bp-country-label">Country</span>
              <div className="field readonly-field country-readonly" role="group" aria-labelledby="bp-country-label">
                <span>{country || "—"}</span>
                <button type="button" className="link-btn" onClick={() => setCountryConfirmed(false)}>Change</button>
              </div>
            </div>
          </div>
          <label className="label" htmlFor="bp-links">Portfolio / GitHub / other links</label><input id="bp-links" className="field" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="github.com/name, yourportfolio.com, behance.net/name" />
          <label className="label" id="step-summary" htmlFor="bp-summary">About you</label><textarea id="bp-summary" className="field" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Final-year B.Com graduate with accounting coursework, Excel reporting practice, and internship exposure to reconciliation." onFocus={() => setHighlightedSection("summary")} onBlur={() => setHighlightedSection(null)} />
          <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: -8 }}>A few honest facts about your background. We&rsquo;ll turn this into a polished summary tailored to the role.</p>

          <div className="section-title" id="step-target"><Briefcase size={18} /><h2>Target job</h2></div>
          {sectionErrors.target && <p id="build-error-target" className="err" role="alert">{sectionErrors.target}</p>}
          <div className="form-grid">
            <div style={{ position: "relative" }}>
              <label className="label" htmlFor="bp-company">Target company</label>
              {(() => { const open = companyOpen && companies.length > 0 && !company; const pick = (c: Company) => { setCompany(c); setCompanyQ(c.name); setCompanies([]); setCompanyOpen(false); setCompanyActive(-1); }; return (<>
              <input id="bp-company" className="field" placeholder="Search any company" role="combobox" aria-expanded={open} aria-controls="company-listbox" aria-autocomplete="list" aria-activedescendant={open && companyActive >= 0 ? `company-opt-${companyActive}` : undefined} value={companyQ} onFocus={() => setCompanyOpen(true)} onBlur={() => setTimeout(() => setCompanyOpen(false), 140)} onChange={(e) => { setCompanyQ(e.target.value); setCompany(null); setCompanyOpen(true); }} onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCompanyOpen(true); setCompanyActive((i) => Math.min(i + 1, companies.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCompanyActive((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { if (open && companyActive >= 0 && companies[companyActive]) { e.preventDefault(); pick(companies[companyActive]); } }
                else if (e.key === "Escape") { setCompanyOpen(false); setCompanyActive(-1); }
              }} />
              {open && <div className="dropdown" role="listbox" id="company-listbox">{companies.map((c, idx) => <div key={c.slug} role="option" id={`company-opt-${idx}`} aria-selected={companyActive === idx} className={companyActive === idx ? "active" : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>{c.name} <span className="ml-1 text-[0.85rem] text-[var(--text-faint)]">{c.country_code}</span></div>)}</div>}
              </>); })()}
            </div>
            <div style={{ position: "relative" }}>
              <label className="label" htmlFor="bp-role">Target role <span style={{ color: "var(--danger)" }}>*</span></label>
              {(() => { const open = roleOpen && roleList.length > 0 && !roleSel; const pick = (r: Role) => { setRoleSel(r); setRoleQ(r.title); setRoleList([]); setRoleOpen(false); setRoleActive(-1); }; return (<>
              <input id="bp-role" className="field" placeholder="Accountant, Data Analyst, Java Developer" role="combobox" aria-required="true" aria-expanded={open} aria-controls="role-listbox" aria-autocomplete="list" aria-activedescendant={open && roleActive >= 0 ? `role-opt-${roleActive}` : undefined} value={roleQ} aria-invalid={invalid.has("role") || undefined} aria-errormessage={invalid.has("role") ? "build-error-target" : undefined} onFocus={() => setRoleOpen(true)} onBlur={() => setTimeout(() => setRoleOpen(false), 140)} onChange={(e) => { setRoleQ(e.target.value); setRoleSel(null); setRoleOpen(true); setInvalid((c) => { if (!c.has("role")) return c; const n = new Set(c); n.delete("role"); return n; }); setSectionErrors((c) => { if (!c.target) return c; const next = { ...c }; delete next.target; return next; }); }} onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setRoleOpen(true); setRoleActive((i) => Math.min(i + 1, roleList.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setRoleActive((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { if (open && roleActive >= 0 && roleList[roleActive]) { e.preventDefault(); pick(roleList[roleActive]); } }
                else if (e.key === "Escape") { setRoleOpen(false); setRoleActive(-1); }
              }} />
              {open && <div className="dropdown" role="listbox" id="role-listbox">{roleList.map((r, idx) => <div key={r.slug} role="option" id={`role-opt-${idx}`} aria-selected={roleActive === idx} className={roleActive === idx ? "active" : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>{r.title}</div>)}</div>}
              </>); })()}
            </div>
          </div>
          <label className="label" htmlFor="bp-jd">Paste job description</label><textarea id="bp-jd" className="field tall" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job post. This improves keyword match and ATS score." />

          <div className="section-title" id="step-evidence"><FileText size={18} /><h2>Resume evidence</h2></div>
          {sectionErrors.evidence && <p id="build-error-evidence" className="err" role="alert">{sectionErrors.evidence}</p>}
          <SkillFields values={skills} onChange={setSkills} suggestions={splitList(ex.skills)} onHighlight={(active) => setHighlightedSection(active ? "skills" : null)} />
          <div id="step-experience">
          <span className="label" id="bp-experience-label">Work experience <span className="text-[0.85rem] text-[var(--muted-fg)]">(internships count — add bullets and let AI sharpen them)</span></span>
          <div role="group" aria-labelledby="bp-experience-label">
            <ExperienceCards experiences={experiences} setExperiences={setExperiences} role={roleQ} company={company?.name || companyQ} />
          </div>
          {experiences.length === 0 && <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: 6 }}>No experience yet? Add education or projects below — they&rsquo;re enough for a strong fresher resume.</p>}
          </div>
          <div className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: 8, marginBottom: 12 }}>
            <b>Metric prompts that raise ATS fast:</b>
            <ul className="quantify-list" style={{ marginTop: 6, marginBottom: 0 }}>
              {metricIdeas.map((prompt, i) => <li key={i}>{prompt}</li>)}
            </ul>
          </div>
          <label className="label" id="step-education" htmlFor="bp-education">Education</label><textarea id="bp-education" className="field" value={edu} onChange={(e) => setEdu(e.target.value)} onFocus={() => setHighlightedSection("education")} onBlur={() => setHighlightedSection(null)} placeholder={ex.education} />
          <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: -8 }}>One per line. Separate parts with &ldquo;|&rdquo;: Degree | School | Year | Details.</p>
          <label className="label" id="step-projects" htmlFor="bp-projects">Projects</label><textarea id="bp-projects" className="field tall" value={projects} onChange={(e) => setProjects(e.target.value)} onFocus={() => setHighlightedSection("projects")} onBlur={() => setHighlightedSection(null)} placeholder={ex.projects} />
          <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: -8 }}>One per line. Format: Project name | what you built and the result.</p>
          <div className="form-grid">
            <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="label mb-0" id="step-extras" htmlFor="bp-certs">Certifications</label><CertificationsPicker value={certs} onChange={setCerts} /></div><textarea id="bp-certs" className="field" value={certs} onChange={(e) => setCerts(e.target.value)} placeholder={ex.certs} /></div>
            <div><label className="label" htmlFor="bp-languages">Languages</label><textarea id="bp-languages" className="field" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder={ex.languages} /></div>
          </div>
          <label className="label" id="step-achievements" htmlFor="bp-achievements">Achievements / activities</label><textarea id="bp-achievements" className="field" value={achievements} onChange={(e) => setAchievements(e.target.value)} placeholder={ex.achievements} />
          <span className="label" id="bp-template-label">Template {!premiumTemplateUnlocked && <span className="text-[0.85rem] text-[var(--muted-fg)]">(Premium or 1 credit unlocks all but Basic)</span>}</span>
          <div className="template-grid" role="radiogroup" aria-labelledby="bp-template-label">
            {TEMPLATES.map((t) => {
              const locked = !premiumTemplateUnlocked && t !== "basic";
              const active = template === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`template-thumb t-${t} ${active ? "active" : ""} ${locked ? "locked" : ""}`}
                  onClick={() => { if (locked) { setErr("That template needs Premium or 1 credit. Basic is free."); return; } setTemplate(t); }}
                  title={locked ? `${t} — Premium` : t}
                >
                  <span className="thumb-preview" aria-hidden="true">
                    <span className="tp-bar tp-name" /><span className="tp-bar tp-sub" />
                    <span className="tp-line" /><span className="tp-line short" /><span className="tp-line" />
                  </span>
                  <span className="thumb-name">{t}{locked && <Lock size={11} />}</span>
                  {active && <span className="thumb-check" aria-hidden="true"><Check size={12} /></span>}
                </button>
              );
            })}
          </div>
          <Button fullWidth id="step-generate" onClick={reviewDetails} disabled={busy} isLoading={busy}>{busy ? "Generating resume…" : "Review details"}</Button>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span className="text-[0.85rem] text-[var(--muted-fg)]">{restored ? <><Check size={13} /> Draft saved automatically</> : "Your progress saves automatically"}</span>
            <Button variant="ghost" size="compact" type="button" onClick={() => setConfirmClear(true)}>Clear form</Button>
          </div>
          {/* API/network/limit failures only — validation reasons render in
              their sections (build-error-profile / -target / -evidence). */}
          {err && <p id="build-error" className="err" role="alert">{err} {(err.includes("Upgrade") || err.includes("Premium")) && <button type="button" className="link-btn" onClick={() => upgrade()}>Upgrade</button>}</p>}
        </section>

        <aside className="preview-rail desk-builder-preview" id="step-export" aria-label="Resume review and export">
          {(true || hasPreviewContent) ? (
            <>
              <div className="card score-card">
                <div className={`score-ring ats-ring ${liveAts ? (liveAts.score >= 80 ? "good" : liveAts.score >= 60 ? "mid" : "low") : ""}`}>
                  {liveAts ? liveAts.score : completeness + "%"}
                </div>
                <div>
                  <h3>{liveAts ? "Estimated ATS score" : "Resume readiness"}</h3>
                  {liveAts
                    ? <p className="text-[13px] leading-[1.5] text-[var(--muted-fg)]"><b>{liveAts.score >= 80 ? "Strong — ready to generate." : liveAts.score >= 60 ? "Decent. Push higher:" : "Add more to climb:"}</b> {liveAts.tip}</p>
                    : <p className="text-[13px] leading-[1.5] text-[var(--muted-fg)]">Your ATS score shows here and climbs as you add detail.</p>}
                </div>
              </div>
              {liveAts && (
                <div className="card">
                  <h3 style={{ marginTop: 0, marginBottom: 10 }}>What moves this toward 100</h3>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <Badge variant={liveAts.exactRoleMatch ? "success" : "warning"}>{liveAts.exactRoleMatch ? "Exact title matched" : "Title needs tightening"}</Badge>
                    <Badge variant={liveAts.keywordCoverage >= 0.85 ? "success" : "warning"}>Keywords {Math.round(liveAts.keywordCoverage * 100)}%</Badge>
                    <Badge variant={liveAts.totalBullets > 0 && liveAts.quantifiedBullets / liveAts.totalBullets >= 0.5 ? "success" : "warning"}>Metrics {liveAts.quantifiedBullets}/{liveAts.totalBullets || 0}</Badge>
                  </div>
                  {liveAts.evidencePrompts.length > 0 && (
                    <ul className="quantify-list" style={{ marginTop: 0 }}>
                      {liveAts.evidencePrompts.map((prompt, i) => <li key={i}>{prompt}</li>)}
                    </ul>
                  )}
                  {!!liveAts.missingKeywords.length && (
                    <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginBottom: 0 }}>
                      Missing or underused keywords: {liveAts.missingKeywords.join(", ")}.
                    </p>
                  )}
                </div>
              )}
              {!out && (
                <div className="card live-preview-card">
                  <div className="live-preview-bar"><h3>Resume preview</h3><span className="text-sm text-[var(--muted-fg)]">Updates as you type</span></div>
                  <div className="live-preview-scroll">
                    <PreviewFrame data={previewData} onSectionClick={scrollToFormSection} highlightedSection={highlightedSection} />
                  </div>
                </div>
              )}
              {out?.content && (
                <div className="card resume-preview">
                  <div className="preview-head">
                    <div><strong>{name || "Your Name"}</strong><p>{out.content.headline}</p></div>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={out.atsScore >= 75 ? "success" : "warning"}>ATS {out.atsScore}</Badge>
                      {outHumanCheck && outHumanCheck.humanScore >= 85 && (
                        <Badge variant="success" title={`Human score ${outHumanCheck.humanScore}% · burstiness ${outHumanCheck.burstiness} — the de-AI pass runs on every generated resume`}>
                          🛡 Bot-Stealth
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p style={{ fontSize: 13 }}>{out.content.summary}</p>
                  <p style={{ fontSize: 12 }}><b>Skills:</b> {(out.content.skills || []).join(" — ")}</p>
                  {(out.content.experiences || []).slice(0, 2).map((e: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, marginTop: 6 }}>
                      <b>{e.title}{e.company ? ` - ${e.company}` : ""}</b>
                      <ul style={{ margin: "2px 0", paddingLeft: 16 }}>{(e.bullets || []).map((b: string, j: number) => <li key={j}>{b}</li>)}</ul>
                    </div>
                  ))}
                  {!!out.content.projects?.length && <p style={{ fontSize: 12 }}><b>Projects:</b> {out.content.projects.slice(0, 2).map((p: any) => p.name).join(" — ")}</p>}
                  {(() => {
                    const weak = unquantifiedBullets(out.content);
                    if (!weak.length) return null;
                    return (
                      <div className="quantify-nudge">
                        <div className="quantify-nudge-head">
                          <Target size={16} />
                          <b>Add numbers to stand out</b>
                        </div>
                        <p className="text-[13px] leading-[1.55] text-[var(--muted-fg)]" style={{ margin: "4px 0 8px" }}>
                          {weak.length} bullet{weak.length > 1 ? "s" : ""} could be stronger with a metric (%, $, count, time saved). Recruiters scan for impact — we won&rsquo;t invent figures, so add your real ones. Edit the bullets above and regenerate, or tweak in the exported file.
                        </p>
                        <ul className="quantify-list">
                          {weak.slice(0, 4).map((w, i) => (
                            <li key={i}><span className="quantify-where">{w.exp}:</span> “{w.bullet.length > 90 ? w.bullet.slice(0, 90) + "..." : w.bullet}”</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  {/* The locked variants below are not dimmed and not
                      cursor-not-allowed: they are enabled and do something when
                      clicked, so 0.55 opacity both failed 4.5:1 contrast and
                      lied about the affordance. The lock icon carries the
                      state. */}
                  <div className="row" style={{ marginTop: 16 }}>
                    <Button as="a" href={`/api/resume/${out.resumeId}/pdf`} aria-disabled={exporting !== null} isLoading={exporting === "pdf"} onClick={(e) => { e.preventDefault(); void downloadResume("pdf"); }}><Download size={16} /> PDF</Button>
                    {docxForOutput ? (
                      <Button as="a" variant="outline" href={`/api/resume/${out.resumeId}/docx`} aria-disabled={exporting !== null} isLoading={exporting === "docx"} onClick={(e) => { e.preventDefault(); void downloadResume("docx"); }}><FileText size={16} /> DOCX</Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => setErr(docxLockedMessage)}><Lock size={16} /> DOCX</Button>
                    )}
                  </div>
                  <AtsSealNotice seal={seal} className="mt-3" />
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button variant="ghost" size="compact" onClick={() => premiumForOutput ? premiumAction("cover") : upgrade()} disabled={extraBusy || upgrading}>{premiumForOutput ? <FileText size={16} /> : <Lock size={16} />} Cover</Button>
                    <Button variant="ghost" size="compact" onClick={() => premiumForOutput ? premiumAction("interview") : upgrade()} disabled={extraBusy || upgrading}>{premiumForOutput ? <MessageSquare size={16} /> : <Lock size={16} />} Interview</Button>
                    <Button variant="ghost" size="compact" onClick={() => premiumForOutput ? premiumAction("linkedin") : upgrade()} disabled={extraBusy || upgrading}>{premiumForOutput ? <Linkedin size={16} /> : <Lock size={16} />} LinkedIn</Button>
                  </div>
                  {!premiumForOutput && <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-center text-[13px] leading-[1.5] text-[var(--muted-fg)]" style={{ marginTop: 8 }}>Free PDF has a watermark. Use credits after your rolling free allowance or <button type="button" className="link-btn font-bold" onClick={() => upgrade()}>Add a Premium pass</button> to remove it and unlock exports.</p>}
                  {out.creditUsed && <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-center text-[13px] leading-[1.5] text-[var(--muted-fg)]" style={{ marginTop: 8 }}>1 credit used. Premium exports are unlocked for this resume.</p>}
                  {extra && <GeneratedOutput label={`${extra.kind} draft`} text={extra.text} />}
                </div>
              )}
            </>
          ) : (
            <div className="card sticky-card flex flex-col items-center justify-center text-center" style={{ minHeight: 220 }}>
              <FileText size={28} className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3" />
              <h3 className="text-base font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">Live preview</h3>
              <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-4">Start filling the form and your resume preview will appear here.</p>
              <span className="text-sm font-semibold text-[var(--color-primary)]">Preview →</span>
            </div>
          )}
          <div className="card">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-2">What we won&rsquo;t do</div>
            <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              <li>— Invent job titles, dates, or metrics.</li>
              <li>— Add photos in markets where they hurt your rank.</li>
              <li>— Use text-in-images or graphics ATS can&rsquo;t read.</li>
            </ul>
          </div>
        </aside>

      </div>

      {/* Spec §3.3: the generate action sticks to the viewport bottom on
          mobile — the form is long and the one button that matters must not
          require a scroll hunt. Hidden ≥lg (the two-column workbench keeps
          the in-flow button in view) and while the first-visit cookie notice
          owns the bottom slot (§3.10); the spacer keeps the footer readable. */}
      {!consentPending && (
        <>
          <div aria-hidden="true" className="h-[4.25rem] lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]/95">
            <Button fullWidth onClick={generate} disabled={busy} isLoading={busy}>Generate resume</Button>
          </div>
        </>
      )}

      {/* Mobile: the desktop result rail is hidden, so the floating action must
          keep generated exports and review details reachable after generation. */}
      <PreviewModal
        visible={hasPreviewContent}
        fabLabel={out ? "Open generated resume and exports" : "Open live resume preview"}
        fabText={out ? "Resume & exports" : "Preview"}
        dialogLabel={out ? "Generated resume and exports" : "Resume preview"}
        title={out ? "Generated resume & exports" : "Live preview"}
      >
        {(closePreview) => (
          <>
            {out?.content ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{name || "Your resume"}</strong>
                    <p className="text-[0.85rem] text-[var(--muted-fg)]">RoleSharp diagnostic estimate: {out.atsScore}/100. This is not an employer decision.</p>
                  </div>
                  <Badge variant={out.atsScore >= 75 ? "success" : "warning"}>{out.atsScore}/100</Badge>
                </div>
                <LivePreview data={{ ...previewData, role: out.content.headline || previewData.role, summary: out.content.summary || previewData.summary, skills: out.content.skills || previewData.skills }} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button as="a" href={`/api/resume/${out.resumeId}/pdf`} aria-disabled={exporting !== null} isLoading={exporting === "pdf"} onClick={(e) => { e.preventDefault(); void downloadResume("pdf"); }}><Download size={16} /> Download PDF</Button>
                  {docxForOutput ? (
                    <Button as="a" variant="outline" href={`/api/resume/${out.resumeId}/docx`} aria-disabled={exporting !== null} isLoading={exporting === "docx"} onClick={(e) => { e.preventDefault(); void downloadResume("docx"); }}><FileText size={16} /> Download DOCX</Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => { closePreview(); setErr(docxLockedMessage); }}><Lock size={16} /> DOCX requires Premium</Button>
                  )}
                </div>
                <AtsSealNotice seal={seal} />
                <Button as="a" variant="ghost" href="/dashboard">Open saved resume library</Button>
              </div>
            ) : (
              <LivePreview data={previewData} />
            )}
          </>
        )}
      </PreviewModal>
      {suggestedJobs.length > 0 && (
        <div className="mx-auto max-w-3xl px-4">
          <RecommendedJobsCard
            jobs={suggestedJobs}
            roleTitle={roleQ || "Target Role"}
            countryCode={countryCode || "US"}
            alertState={alertState}
            onEnrollAlert={() => void enrollWeeklyAlert()}
            onTailorClick={(title, companyName) => {
              setRoleQ(title);
              setCompanyQ(companyName);
              setRoleSel(null); setCompany(null);
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
          />
        </div>
      )}

      <div className="text-center mt-6 mb-2">
        <a href="/build/help" className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] hover:text-[var(--color-primary)] transition-colors">
          When to use this builder →
        </a>
      </div>

      <FaqSection heading="Resume builder — common questions" faqs={BUILD_FAQS} />
      {reviewRequest && (
        <GenerationReview
          request={reviewRequest}
          company={company?.name || companyQ.trim()}
          role={roleSel?.title || roleQ.trim()}
          onEdit={editReviewedSection}
          onClose={() => setReviewRequest(null)}
          onConfirm={generate}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Clear the whole form?"
          body="Every field, the job description, and the saved draft on this device are reset. A resume you have already generated is not affected."
          confirmLabel="Clear form"
          destructive
          onConfirm={() => { setConfirmClear(false); clearForm(); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </main>
  );
}
