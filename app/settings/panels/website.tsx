"use client";
import { useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import { Grid } from "../../icons";
import Skeleton from "@/components/ui/Skeleton";
import FeatureSection from "../feature-section";
import { HANDLE_MESSAGES, handleError, normalizeHandle, PORTFOLIO_MAX, cleanCaseStudies, CASE_STUDY_MAX, type CaseStudyItem, type PortfolioItem } from "@/lib/personal-site";

type Site = {
  handle: string;
  resume_id: string;
  display_name: string;
  show_contact: boolean;
  indexable: boolean;
  talent_opt_in?: boolean;
  portfolio: PortfolioItem[];
  case_studies?: CaseStudyItem[];
  published_at: string | null;
};
type Resume = { id: string; candidate_name?: string | null; role_title?: string | null; created_at?: string };

export default function WebsitePanel() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [handle, setHandle] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [indexable, setIndexable] = useState(false);
  const [talentOptIn, setTalentOptIn] = useState(false);
  const [introCount, setIntroCount] = useState(0);
  const [published, setPublished] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [siteResponse, resumeResponse] = await Promise.all([
        fetch("/api/personal-site", { cache: "no-store" }),
        fetch("/api/resumes", { cache: "no-store" }),
      ]);
      const [siteData, resumeData] = await Promise.all([
        siteResponse.json().catch(() => null),
        resumeResponse.json().catch(() => null),
      ]);
      if (!siteResponse.ok || !resumeResponse.ok || !resumeData) throw new Error("website_settings_unavailable");
      const site: Site | null = siteData?.site ?? null;
      const list: Resume[] = resumeData?.resumes ?? resumeData ?? [];
      if (!Array.isArray(list)) throw new Error("resume_list_unavailable");
      setResumes(Array.isArray(list) ? list : []);
      if (site) {
        setHandle(site.handle);
        setResumeId(site.resume_id);
        setDisplayName(site.display_name);
        setShowContact(site.show_contact);
        setIndexable(site.indexable);
        setTalentOptIn(Boolean(site.talent_opt_in));
        try {
          const introRes = await fetch("/api/talent/intro", { cache: "no-store" });
          if (introRes.ok) {
            const introData = await introRes.json();
            setIntroCount(Number(introData.pending ?? 0));
          }
        } catch {}
        setPortfolio(site.portfolio ?? []);
        setCaseStudies(site.case_studies ?? []);
        setPublished(Boolean(site.published_at));
      }
    } catch {
      setLoadError("Your website settings could not be loaded. Your saved page has not been changed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(nextPublished: boolean) {
    const invalid = handleError(handle);
    if (invalid) { setMessage(HANDLE_MESSAGES[invalid]); return; }
    if (!resumeId) { setMessage("Choose which resume the page should show."); return; }
    if (!displayName.trim()) { setMessage("Add the name to show at the top of the page."); return; }

    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/personal-site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: normalizeHandle(handle),
          resumeId,
          displayName: displayName.trim(),
          showContact,
          indexable,
          talentOptIn,
          portfolio: portfolio.filter((item) => item.title.trim()),
          caseStudies: cleanCaseStudies(caseStudies),
          published: nextPublished,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setMessage(data?.message ?? "Could not save the page."); return; }
      setPublished(Boolean(data.site?.published_at));
      setMessage(nextPublished ? "Your page is live." : "Your page is offline. The link now returns a not-found.");
    } catch {
      setMessage("Could not save the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeatureSection icon={<Grid size={20} />} title="Personal website" description="Publish your resume as a shareable page at your own slug.">
      <Notice variant="neutral" className="mb-5">
        This is the one place RoleSharp puts your details where a stranger can read them. Nothing is
        public until you press Publish, contact details stay off unless you switch them on, and the
        page asks search engines not to index it until you say otherwise.
      </Notice>

      {loading ? (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton variant="card" height="7rem" />
        </div>
      ) : loadError ? (
        <div role="alert">
          <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>Retry</Button>
        </div>
      ) : resumes.length === 0 ? (
        <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          You need a saved resume first. <a className="text-[var(--color-primary)] underline" href="/build">Tailor one</a> or{" "}
          <a className="text-[var(--color-primary)] underline" href="/resume-maker">build one</a>.
        </p>
      ) : (
        <div className="grid gap-4">
          <label className="grid gap-1">
            <strong>Address</strong>
            <span className="flex min-w-0 items-center gap-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              <span className="shrink-0">rolesharp.com/u/</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="your-name"
                className="w-full min-w-0 flex-1 rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
              />
            </span>
          </label>

          <label className="grid gap-1">
            <strong>Name shown at the top</strong>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
            />
          </label>

          <label className="grid gap-1">
            <strong>Which resume</strong>
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
            >
              <option value="">Choose a saved resume</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {[r.candidate_name, r.role_title].filter(Boolean).join(" — ") || r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <div>
              <strong className="block">Portfolio</strong>
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Work worth clicking: a case study, a repository, a shipped product. A title is enough — the link is optional.
              </small>
            </div>
            {portfolio.map((item, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={item.title}
                  onChange={(e) => setPortfolio((list) => list.map((row, j) => (j === i ? { ...row, title: e.target.value } : row)))}
                  placeholder="Title"
                  className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
                <input
                  value={item.url ?? ""}
                  onChange={(e) => setPortfolio((list) => list.map((row, j) => (j === i ? { ...row, url: e.target.value } : row)))}
                  placeholder="https:// (optional)"
                  className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
                <Button variant="outline" onClick={() => setPortfolio((list) => list.filter((_, j) => j !== i))}>Remove</Button>
                <textarea
                  value={item.description ?? ""}
                  onChange={(e) => setPortfolio((list) => list.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)))}
                  placeholder="One line on what it is and what changed because of it (optional)"
                  rows={2}
                  className="sm:col-span-3 rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
              </div>
            ))}
            {portfolio.length < PORTFOLIO_MAX ? (
              <div>
                <Button variant="outline" onClick={() => setPortfolio((list) => [...list, { title: "" }])}>Add an item</Button>
              </div>
            ) : (
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">That is the maximum of {PORTFOLIO_MAX}.</small>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <div>
              <strong className="block">Case studies</strong>
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Problem → approach → result, up to {CASE_STUDY_MAX}. State only what actually happened — metric
                placeholders like [30%] stay bracketed until you have the real number; nothing is invented for you.
              </small>
            </div>
            {caseStudies.map((study, i) => (
              <div key={i} className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={study.title}
                    onChange={(e) => setCaseStudies((list) => list.map((row, j) => (j === i ? { ...row, title: e.target.value } : row)))}
                    placeholder="Case study title"
                    className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                  />
                  <input
                    value={study.url ?? ""}
                    onChange={(e) => setCaseStudies((list) => list.map((row, j) => (j === i ? { ...row, url: e.target.value } : row)))}
                    placeholder="https:// (optional proof link)"
                    className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                  />
                  <Button variant="outline" onClick={() => setCaseStudies((list) => list.filter((_, j) => j !== i))}>Remove</Button>
                </div>
                <textarea
                  value={study.problem}
                  onChange={(e) => setCaseStudies((list) => list.map((row, j) => (j === i ? { ...row, problem: e.target.value } : row)))}
                  placeholder="The problem — what was broken, for whom"
                  rows={2}
                  className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
                <textarea
                  value={study.approach}
                  onChange={(e) => setCaseStudies((list) => list.map((row, j) => (j === i ? { ...row, approach: e.target.value } : row)))}
                  placeholder="Your approach — what you did, decisions you made"
                  rows={2}
                  className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
                <textarea
                  value={study.result}
                  onChange={(e) => setCaseStudies((list) => list.map((row, j) => (j === i ? { ...row, result: e.target.value } : row)))}
                  placeholder="The result — what changed, with a real number or an honest observed outcome"
                  rows={2}
                  className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] px-3 py-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"
                />
              </div>
            ))}
            {caseStudies.length < CASE_STUDY_MAX ? (
              <div>
                <Button variant="outline" onClick={() => setCaseStudies((list) => [...list, { title: "", problem: "", approach: "", result: "" }])}>
                  Add a case study
                </Button>
              </div>
            ) : (
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">That is the maximum of {CASE_STUDY_MAX}.</small>
            )}
          </div>

          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <span>
              <strong className="block">Show contact details</strong>
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Email, phone, location and LinkedIn. Off by default — a public page is readable by anyone, including scrapers.
              </small>
            </span>
            <input type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} />
          </label>

          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <span>
              <strong className="block">Let search engines index it</strong>
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Off by default. With this off the page still works for anyone you send the link to; it just does not turn up in search and is not listed in the public directory.
              </small>
            </span>
            <input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} />
          </label>

          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4 dark:border-[var(--color-dark-border)]">
            <span>
              <strong className="block">Appear in anonymized talent search</strong>
              <small className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                Off by default. On: your role, skills, experience, and ATS score appear at /talent with no name, no
                contact details, and no employer data. Recruiters send an intro request; you see it here and decide
                whether to reply. Nothing about you is shown before you choose to respond.
                {introCount > 0 ? ` You have ${introCount} pending request${introCount === 1 ? "" : "s"}.` : ""}
              </small>
            </span>
            <input type="checkbox" checked={talentOptIn} onChange={(e) => setTalentOptIn(e.target.checked)} />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save(true)} disabled={busy} isLoading={busy}>
              {published ? "Save changes" : "Publish"}
            </Button>
            {published ? (
              <>
                <Button onClick={() => save(false)} disabled={busy} variant="outline">Take it offline</Button>
                <Button as="a" href={`/u/${normalizeHandle(handle)}`} variant="outline">View page</Button>
              </>
            ) : null}
            {message && <span role="status" className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{message}</span>}
          </div>
        </div>
      )}
    </FeatureSection>
  );
}
