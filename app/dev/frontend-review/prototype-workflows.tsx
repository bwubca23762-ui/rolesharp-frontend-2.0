"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import GenerationReview, { type ReviewRequest } from "@/app/build/generation-review";
import SkillFields from "@/app/build/skill-fields";
import type { CheckResult } from "@/lib/resume-checker";
import type { ResumeContent } from "@/lib/types";
import { splitPeriod } from "@/lib/resume-form/from-resume-content";
import { bulletLines, parseEducation, parseProjects } from "@/lib/resume-form/parse";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applications/contracts";
import styles from "./prototype.module.css";

type SavedResume = { id: string; candidate_name: string; headline?: string };
type Application = { id: string; company: string; role: string; status: ApplicationStatus };
type Job = { id: string; title: string; company: string; location: string; description?: string };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (response.status === 401) throw new Error("Sign in to open your saved workspace.");
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The request failed. Please try again.");
  return result;
}

function Feedback({ error, busy }: { error: string; busy: boolean }) {
  return <>
    {busy && <p role="status">Loading your workspace…</p>}
    {error && <p role="alert">{error} {error.startsWith("Sign in") && <Link href="/login?next=%2Fdev%2Ffrontend-review%2Fworkspace">Sign in</Link>}</p>}
  </>;
}

export function ResumeSheet({ content, name }: { content: ResumeContent; name: string }) {
  return <section className={styles.resumeSheet} aria-label="Resume preview">
    <div className={styles.sheetHeader}><div><strong>{name}</strong><span>{content.headline}</span></div></div>
    <p className={styles.sheetRole}>{content.summary}</p>
    <div className={styles.sheetRule} />
    {(content.experiences ?? []).map((entry, index) => <div key={index} className={styles.sheetRole}>
      <strong>{entry.title}</strong><span>{entry.company}</span>
      <ul>{entry.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>
    </div>)}
    <p className={styles.sheetLabel}>Skills</p><p>{content.skills.join(", ")}</p>
  </section>;
}

export function PrototypeChecker() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try { setResult(await request<CheckResult>("/api/check-resume", { method: "POST", body: JSON.stringify({ resumeText: text }) })); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not check this resume."); }
    finally { setBusy(false); }
  }
  return <main className={styles.screen}>
    <div className={styles.pageIntro}><h1>Resume check</h1><p>Read the evidence in your resume before tailoring.</p></div>
    <div className={styles.checkLayout}>
      <form className={styles.documentPanel} onSubmit={check}>
        <label className={styles.field}>Resume text<textarea required minLength={80} maxLength={30000} rows={15} value={text} onChange={event => setText(event.target.value)} /></label>
        <button className={styles.button} disabled={busy}>{busy ? "Checking…" : "Check resume"}</button>
      </form>
      <aside className={styles.analysisPanel} aria-label="Resume analysis" aria-live="polite">
        <Feedback busy={busy} error={error} />
        {result ? <>
          <div className={styles.scoreTop}><div><span>Resume diagnostic</span><strong>{result.score}</strong><small>of 100</small></div><p>{result.verdict}</p></div>
          <div className={styles.scoreRows}>{result.breakdown.map(row => <div key={row.label}><span>{row.label}</span><strong>{Math.round(row.score)}/{row.max}</strong><small>{row.note}</small></div>)}</div>
        </> : !busy && <p>Paste your resume to see its score and specific improvement suggestions.</p>}
        <Link className={styles.buttonQuiet} href="/dev/frontend-review/build">Tailor in Studio</Link>
      </aside>
    </div>
  </main>;
}

export function PrototypeStudio() {
  const generating = useRef(false);
  const [draft, setDraft] = useState<ReviewRequest | null>(null);
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [moreDetails, setMoreDetails] = useState(false);
  const [result, setResult] = useState<{ resumeId: string; content: ResumeContent } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const resumes = await request<SavedResume[]>("/api/resumes");
        const params = new URLSearchParams(window.location.search);
        const saved = resumes[0] ? await request<{ candidateName: string; content: ResumeContent }>("/api/resume/" + resumes[0].id) : null;
        if (!active) return;
        const content = saved?.content;
        setDraft({
          profile: { name: saved?.candidateName ?? "", ...content?.contact, summary: content?.summary ?? "", skills: content?.skills?.length ? content.skills : [""],
            experiences: (content?.experiences ?? []).map(entry => {
              const period = splitPeriod(entry.period);
              return { title: entry.title, company: entry.company ?? "", start: period.start, end: period.current ? "Present" : period.end, bullets: entry.bullets };
            }),
            education: content?.education ?? [], projects: content?.projects ?? [], links: content?.contact?.links ?? [],
            certifications: content?.certifications ?? [], languages: content?.languages ?? [], achievements: content?.achievements ?? [] },
          roleTitleRaw: params.get("role") ?? content?.headline ?? "Product Manager",
          companyNameRaw: params.get("company") ?? "",
          jdText: "",
          template: ["basic", "modern", "compact", "executive"].includes(params.get("template") ?? "") ? params.get("template")! : "basic",
        });
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not load your resume."); }
      finally { if (active) setBusy(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  async function generate() {
    if (!review || busy || generating.current) return;
    generating.current = true;
    setBusy(true); setError("");
    try {
      const generated = await request<{ resumeId: string; content?: ResumeContent }>("/api/generate", { method: "POST", body: JSON.stringify(review) });
      let content = generated.content;
      for (let attempt = 0; !content && attempt < 18; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const response = await fetch("/api/resume/" + generated.resumeId, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (response.status === 404) continue;
        if (!response.ok) throw new Error("Generation could not finish. Check your workspace before trying again.");
        content = (await response.json()).content;
      }
      if (!content) throw new Error("Generation is still processing. Check your workspace before trying again.");
      setResult({ resumeId: generated.resumeId, content });
      setReview(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not generate your resume."); }
    finally { generating.current = false; setBusy(false); }
  }
  function updateExperience(index: number, patch: Partial<ReviewRequest["profile"]["experiences"][number]>) {
    if (!draft) return;
    setDraft({ ...draft, profile: { ...draft.profile, experiences: draft.profile.experiences.map((entry, row) => row === index ? { ...entry, ...patch } : entry) } });
  }
  return <main className={styles.screen}>
    <div className={styles.pageIntro}><h1>Resume Studio</h1><p>Choose your evidence, review it, then save a tailored version.</p></div>
    {!review && <Feedback busy={busy} error={error} />}
    {review ? <GenerationReview request={review} company={review.companyNameRaw ?? ""} role={review.roleTitleRaw ?? ""} onEdit={() => { setMoreDetails(true); setReview(null); }} onBack={() => setReview(null)} onConfirm={generate} busy={busy} err={error} /> : draft && <div className={styles.buildGrid}>
      <form className={styles.editorPanel} onSubmit={event => {
        event.preventDefault(); setError(""); setResult(null);
        const experiences = draft.profile.experiences.filter((_, index) => !excluded.includes(index));
        if (!experiences.length && !draft.profile.education.length && !draft.profile.projects.length) {
          setError("Keep at least one experience, education entry, or project before generating.");
          return;
        }
        setReview({ ...draft, profile: { ...draft.profile, skills: [...new Set(draft.profile.skills.map(skill => skill.trim()).filter(Boolean))], experiences } });
      }}>
        <label className={styles.field}>Full name<input required value={draft.profile.name} onChange={event => setDraft({ ...draft, profile: { ...draft.profile, name: event.target.value } })} /></label>
        <label className={styles.field}>Target role<input required value={draft.roleTitleRaw} onChange={event => setDraft({ ...draft, roleTitleRaw: event.target.value })} /></label>
        <label className={styles.field}>Company<input value={draft.companyNameRaw} onChange={event => setDraft({ ...draft, companyNameRaw: event.target.value })} /></label>
        <h2>Choose the proof to lead with</h2>
        {draft.profile.experiences.map((entry, index) => <label className={styles.checkOption} key={index}>
          <input type="checkbox" checked={!excluded.includes(index)} onChange={event => setExcluded(event.target.checked ? excluded.filter(value => value !== index) : [...excluded, index])} />
          <span>{entry.title} · {entry.company}</span><small>{entry.bullets.join(" ")}</small>
        </label>)}
        <SkillFields values={draft.profile.skills} onChange={skills => setDraft({ ...draft, profile: { ...draft.profile, skills } })} suggestions={[]} onHighlight={() => {}} />
        <label className={styles.field}>Summary<textarea rows={3} value={draft.profile.summary} onChange={event => setDraft({ ...draft, profile: { ...draft.profile, summary: event.target.value } })} /></label>
        <details open={moreDetails} onToggle={event => setMoreDetails(event.currentTarget.open)}>
          <summary>Contact, experience and other details</summary>
          {(["email", "phone", "linkedin", "location", "country"] as const).map(field => <label className={styles.field} key={field}>{field}
            <input aria-label={"Profile " + field} value={draft.profile[field] ?? ""} onChange={event => setDraft({ ...draft, profile: { ...draft.profile, [field]: event.target.value } })} />
          </label>)}
          <label className={styles.field}>Profile links (one per line)<textarea defaultValue={draft.profile.links.join("\n")} onBlur={event => setDraft({ ...draft, profile: { ...draft.profile, links: bulletLines(event.target.value) } })} /></label>
          <label className={styles.field}>Job description<textarea rows={4} value={draft.jdText ?? ""} onChange={event => setDraft({ ...draft, jdText: event.target.value })} /></label>
          {draft.profile.experiences.map((entry, index) => <fieldset key={index}>
            <legend>Experience {index + 1}</legend>
            {(["title", "company", "start", "end"] as const).map(field => <label className={styles.field} key={field}>{field}
              <input aria-label={"Experience " + (index + 1) + " " + field} value={entry[field] ?? ""} onChange={event => updateExperience(index, { [field]: event.target.value })} />
            </label>)}
            <label className={styles.field}>Experience {index + 1} bullets (one per line)<textarea defaultValue={entry.bullets.join("\n")} onBlur={event => updateExperience(index, { bullets: bulletLines(event.target.value) })} /></label>
          </fieldset>)}
          <label className={styles.field}>Education (degree | school | year | detail, one per line)<textarea defaultValue={draft.profile.education.map(entry => [entry.degree, entry.school, entry.year ?? "", entry.detail ?? ""].join(" | ")).join("\n")} onBlur={event => setDraft({ ...draft, profile: { ...draft.profile, education: parseEducation(event.target.value) } })} /></label>
          <label className={styles.field}>Projects (name | detail, one per line)<textarea defaultValue={draft.profile.projects.map(entry => entry.name + " | " + entry.detail).join("\n")} onBlur={event => setDraft({ ...draft, profile: { ...draft.profile, projects: parseProjects(event.target.value) } })} /></label>
          {(["certifications", "languages", "achievements"] as const).map(field => <label className={styles.field} key={field}>{field} (one per line)
            <textarea aria-label={"Profile " + field} defaultValue={draft.profile[field].join("\n")} onBlur={event => setDraft({ ...draft, profile: { ...draft.profile, [field]: bulletLines(event.target.value) } })} />
          </label>)}
        </details>
        <label className={styles.field}>Template<select value={draft.template} onChange={event => setDraft({ ...draft, template: event.target.value })}>
          {["basic", "modern", "compact", "executive"].map(template => <option key={template}>{template}</option>)}
        </select></label>
        <button className={styles.button} disabled={busy}>Review details</button>
      </form>
      <div className={styles.previewColumn}>
        {result ? <>
          <p role="status">Resume saved to your workspace.</p>
          <ResumeSheet content={result.content} name={draft.profile.name} />
          <Link className={styles.button} href={"/resumes/" + result.resumeId}>Open saved resume</Link>
          <Link className={styles.buttonQuiet} href={"/api/resume/" + result.resumeId + "/pdf"}>Download PDF</Link>
        </> : <section className={styles.resumeSheet} aria-label="Live resume preview"><div className={styles.sheetHeader}><strong>{draft.profile.name}</strong></div><p>{draft.profile.summary}</p>
          {draft.profile.experiences.filter((_, index) => !excluded.includes(index)).map((entry, index) => <div className={styles.sheetRole} key={index}><strong>{entry.title} · {entry.company}</strong><ul>{entry.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul></div>)}
          <p>{draft.profile.skills.filter(Boolean).join(", ")}</p>
        </section>}
      </div>
    </div>}
  </main>;
}

export function PrototypeJobs() {
  const [query, setQuery] = useState("Product Manager");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await request<{ jobs: Job[] }>("/api/jobs?q=" + encodeURIComponent(query)); setJobs(result.jobs); setSearched(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Search failed."); }
    finally { setBusy(false); }
  }
  return <main className={styles.screen}>
    <div className={styles.pageIntro}><h1>Find roles worth tailoring for</h1><p>Search your local job listings, then tailor your resume.</p></div>
    <form className={styles.jobFilter} onSubmit={search}><input aria-label="Role search" value={query} onChange={event => setQuery(event.target.value)} /><button className={styles.button} disabled={busy}>Search jobs</button></form>
    <Feedback busy={busy} error={error} />
    {searched && jobs.length === 0 && <p role="status">No roles match this search. Try a different title.</p>}
    <section className={styles.jobList}>{jobs.map(job => <article key={job.id} className={styles.jobRow}>
      <div className={styles.companyMark}>{job.company[0]}</div><div className={styles.jobMain}><h2>{job.title}</h2><p>{job.company} · {job.location}</p></div>
      <Link className={styles.buttonQuiet} href={"/dev/frontend-review/build?" + new URLSearchParams({ role: job.title, company: job.company })}>Tailor</Link>
    </article>)}</section>
  </main>;
}

export function PrototypeTracker() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  async function load() {
    const result = await request<{ applications: Application[] }>("/api/applications?limit=100");
    setApplications(result.applications);
  }
  useEffect(() => {
    let active = true;
    request<{ applications: Application[] }>("/api/applications?limit=100")
      .then(result => { if (active) setApplications(result.applications); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function change(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save the application."); }
    finally { setBusy(false); }
  }
  return <main className={styles.screen}>
    <div className={styles.pageIntro}><h1>Application tracker</h1><p>Update a stage and keep your next move in view.</p></div>
    <form className={styles.jobFilter} onSubmit={event => { event.preventDefault(); void change(async () => {
      await request("/api/applications", { method: "POST", body: JSON.stringify({ company, role }) }); setCompany(""); setRole("");
    }); }}>
      <input aria-label="Company" required maxLength={120} value={company} onChange={event => setCompany(event.target.value)} />
      <input aria-label="Role" required maxLength={120} value={role} onChange={event => setRole(event.target.value)} />
      <button className={styles.button} disabled={busy}>Add application</button>
    </form>
    <Feedback busy={busy} error={error} />
    <div className={styles.trackHead}><span>{applications.length} applications</span></div>
    <section className={styles.board}>
      {APPLICATION_STATUSES.map(status => <div className={styles.boardColumn} key={status}>
        <h2>{status}<span>{applications.filter(entry => entry.status === status).length}</span></h2>
        {applications.filter(entry => entry.status === status).map(entry => <article key={entry.id}>
          <h3>{entry.company}</h3><p>{entry.role}</p>
          <label className={styles.field}>Stage for {entry.company}<select value={entry.status} disabled={busy} onChange={event => {
            void change(() => request("/api/applications/" + entry.id, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }));
          }}>{APPLICATION_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>
        </article>)}
      </div>)}
    </section>
  </main>;
}

export function PrototypeWorkspace() {
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request<SavedResume[]>("/api/resumes")
      .then(result => { if (active) setResumes(result); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  return <main className={styles.screen}><div className={styles.workspaceHero}><div><h1>Your next application.</h1><p>Open a saved resume or tailor a new version.</p></div><Link className={styles.button} href="/dev/frontend-review/build">Open Resume Studio</Link></div>
    <Feedback busy={busy} error={error} />
    <div className={styles.workspaceGrid}><section className={styles.plan}><h2>Next steps</h2><p><Link href="/dev/frontend-review/jobs">Find a role</Link></p><p><Link href="/dev/frontend-review/track">Update your tracker</Link></p></section>
      <section className={styles.workspaceResume}><h2>Saved resumes</h2>{!busy && !error && resumes.length === 0 && <p>No saved resumes yet.</p>}
        {resumes.map(resume => <p key={resume.id}><Link href={"/resumes/" + resume.id}>{resume.candidate_name} · {resume.headline ?? "Resume"}</Link></p>)}
      </section></div>
  </main>;
}
