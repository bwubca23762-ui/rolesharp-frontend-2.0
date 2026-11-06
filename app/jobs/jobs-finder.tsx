"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, Target } from "../icons";
import {
  countryShortName,
  getCountryByCode,
  JOB_COUNTRIES,
  POPULAR_CHIP_CODES,
  refreshLabelForCountry,
  TIER3_CODES,
} from "@/lib/job-config";
import { Button } from "@/components/ui/primitives";
import { useSession } from "@/app/session-context";

type Job = {
  id: string;
  provider: string;
  external_id: string;
  title: string;
  company: string;
  country_code: string;
  location?: string;
  is_remote: boolean;
  job_type?: string;
  description_excerpt?: string;
  apply_url: string;
  reposted?: boolean;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_interval?: string;
  date_posted?: string;
  posted_days_ago?: number;
};

type FitBadge = {
  fitScore: number;
  grade: "Excellent" | "Strong" | "Fair" | "Weak";
  matched: number;
  missing: number;
  topMissing: string[];
};

const FIT_BADGE_STYLES: Record<FitBadge["grade"], string> = {
  Excellent: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Strong: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  Fair: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Weak: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400",
};

type JobsFinderProps = {
  initialCountry?: string;
  initialJobType?: "fulltime" | "parttime" | "internship" | "contract" | "temporary";
  initialQuery?: string;
  lockJobType?: boolean;
  resultLabel?: string;
  heroKicker?: string;
  heroTitle?: string;
  heroSubtitle?: string;
};

const POPULAR_COUNTRIES = POPULAR_CHIP_CODES
  .map((code) => getCountryByCode(code))
  .filter((item): item is NonNullable<typeof item> => Boolean(item));

const POPULAR_SELECT_COUNTRIES = JOB_COUNTRIES.filter((country) => country.tier < 3);
const ALL_COUNTRIES_ALPHA = [...JOB_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const POPULAR_SELECT_CODES = new Set(POPULAR_SELECT_COUNTRIES.map((country) => country.code));
const OTHER_COUNTRIES_ALPHA = ALL_COUNTRIES_ALPHA.filter(
  (country) => !POPULAR_SELECT_CODES.has(country.code),
);

function flag(code: string) {
  return String.fromCodePoint(...code.toUpperCase().split("").map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

function formatDate(daysAgo?: number, value?: string) {
  const days =
    typeof daysAgo === "number" && Number.isFinite(daysAgo)
      ? Math.max(0, Math.floor(daysAgo))
      : value
        ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000))
        : null;
  if (days === null) return "Recently found";
  return days === 0 ? "Posted today" : days === 1 ? "Posted yesterday" : `Posted ${days} days ago`;
}

function formatSalary(job: Job) {
  if (!job.salary_min && !job.salary_max) return "";
  const currency = job.salary_currency || "";
  const number = (value?: number) =>
    value == null ? "" : new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
  const range =
    job.salary_min && job.salary_max
      ? `${number(job.salary_min)}-${number(job.salary_max)}`
      : number(job.salary_min || job.salary_max);
  return `${currency} ${range}${job.salary_interval ? ` / ${job.salary_interval}` : ""}`.trim();
}

function jobTypeLabel(value?: string) {
  return value ? value.replaceAll("_", " ").replaceAll(",", " —") : "";
}

function dedupeJobs(items: Job[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function loginUrl(pathname: string) {
  return `/login?next=${encodeURIComponent(pathname || "/jobs")}`;
}

function SkeletonRows() {
  return (
    <div className="jobs-list" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="job-row job-row-skeleton" key={index}>
          <div className="job-row-avatar skeleton-block" />
          <div className="job-row-main">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-meta" />
            <div className="skeleton-line skeleton-copy" />
            <div className="skeleton-line skeleton-copy short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JobsFinder({
  initialCountry,
  initialJobType,
  initialQuery = "",
  lockJobType = false,
  resultLabel = "jobs",
  heroKicker = "Fresh listings — 72 countries",
  heroTitle = "Find fresh jobs in your country",
  heroSubtitle = "Search every market Indeed serves, filter for remote work or salary, and tailor your resume to the exact posting when you find a fit.",
}: JobsFinderProps) {
  const pathname = usePathname();
  const {
    session: me,
    loading: sessionLoading,
    error: sessionError,
    refreshSession,
  } = useSession();
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState(initialCountry && getCountryByCode(initialCountry) ? initialCountry : "US");
  const [jobType, setJobType] = useState(initialJobType ?? "");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<"newest" | "salary">("newest");
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [fuzzy, setFuzzy] = useState(false);
  const [fitBadges, setFitBadges] = useState<Record<string, FitBadge>>({});
  const [alertState, setAlertState] = useState<"idle" | "creating" | "created">("idle");
  const [alertError, setAlertError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (initialCountry && getCountryByCode(initialCountry)) {
      setCountry(initialCountry);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem("rolesharp-country") || "null");
      if (stored?.code && getCountryByCode(stored.code)) setCountry(stored.code);
    } catch {}
  }, [initialCountry]);

  useEffect(() => {
    if (initialJobType) {
      setJobType(initialJobType);
      setPage(1);
    }
  }, [initialJobType]);

  useEffect(() => {
    if (me?.loggedIn === false) {
      setLoading(false);
      setJobs([]);
      setTotal(0);
      return;
    }
    if (!me?.loggedIn) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        country,
        page: String(page),
        limit: "20",
        sort: sort === "salary" ? "salary" : "posted",
      });
      if (query.trim()) params.set("q", query.trim());
      if (jobType) params.set("type", jobType);
      if (remote) params.set("remote", "true");
      try {
        const response = await fetch(`/api/jobs?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (response.status === 401) {
          await refreshSession();
          return;
        }
        if (!response.ok) throw new Error();
        const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs((current) => (page === 1 ? nextJobs : dedupeJobs([...current, ...nextJobs])));
        if (typeof data.total === "number") setTotal(data.total);
        setFuzzy(page === 1 && data.fuzzy === true);
        setFitBadges((current) =>
          page === 1 ? (data.badges ?? {}) : { ...current, ...(data.badges ?? {}) },
        );
      } catch (err: any) {
        if (err?.name !== "AbortError") setError("Fresh jobs are temporarily unavailable. Please try again shortly.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [country, jobType, me, page, query, refreshSession, remote, sort]);

  const selectedCountry = getCountryByCode(country) ?? JOB_COUNTRIES[0];
  const freshness = refreshLabelForCountry(selectedCountry.code);
  const showGate = me?.loggedIn === false && !sessionError;
  // Scroll-jump guard: only show full SkeletonRows on cold initial load when jobs.length === 0!
  // When jobs are already rendered and the user changes a filter/query on page 1, keep the
  // existing list mounted with subtle opacity so the document height never collapses mid-scroll.
  const showInitialLoading =
    !sessionError && (sessionLoading || me === null || (loading && page === 1 && jobs.length === 0));
  const isRefreshingPage1 = loading && page === 1 && jobs.length > 0;
  const showing = jobs.length;
  const hasMore = showing < total;
  const emptyRefreshLine = TIER3_CODES.includes(selectedCountry.code)
    ? "This market refreshes daily, so broaden the title or check back tomorrow."
    : "Try a broader title or remove one filter. This market keeps refreshing on a rolling schedule.";

  useEffect(() => {
    setAlertState("idle");
    setAlertError("");
  }, [query, country]);

  function resetFilters() {
    setQuery("");
    if (!lockJobType) setJobType("");
    setRemote(false);
    setSort("newest");
    setPage(1);
  }

  async function createSearchAlert() {
    const keyword = query.trim().slice(0, 60);
    if (keyword.length < 2) return;
    setAlertState("creating");
    setAlertError("");
    try {
      const response = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKeyword: keyword, countryCode: country, frequency: "weekly" }),
      });
      if (response.status === 401) {
        window.location.href = loginUrl(pathname || "/jobs");
        return;
      }
      if (response.ok) {
        setAlertState("created");
        return;
      }
      const failure = await response.json().catch(() => ({}));
      setAlertState("idle");
      setAlertError(
        failure.error === "limit_free"
          ? "Free accounts get one weekly alert. Manage it under Job alerts, or go Premium for three daily alerts."
          : failure.error === "limit_premium"
            ? "You already have three alerts — pause or delete one under Job alerts first."
            : failure.error === "email_verification_required"
              ? "Verify your email address first — alerts are only sent to verified inboxes."
              : "Could not create that alert. Please try again.",
      );
    } catch {
      setAlertState("idle");
      setAlertError("Could not create that alert. Please try again.");
    }
  }

  async function saveJob(job: Job) {
    setSavingJobId(job.id);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          jobId: job.id,
          provider: job.provider,
          providerJobId: job.external_id,
          jobUrl: job.apply_url,
          notes: `Found on ${job.provider} via RoleSharp Jobs`,
        }),
      });
      if (response.status === 401) {
        window.location.href = loginUrl(pathname || "/jobs");
        return;
      }
      if (response.ok || response.status === 409) {
        setSaved((current) => ({ ...current, [job.id]: true }));
      } else {
        const failure = await response.json().catch(() => ({}));
        setError(
          failure.error === "job_identity_mismatch"
            ? "That listing changed while you were viewing it. Refresh the jobs page and try again."
            : "Could not save that job. Please try again.",
        );
      }
    } finally {
      setSavingJobId(null);
    }
  }

  return (
    <div>
      <section className="jobs-hero border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-2">
                {heroKicker}
              </span>
              <h1>{heroTitle}</h1>
              <p>{heroSubtitle}</p>
            </div>
            {me?.loggedIn && <div className="flex flex-wrap gap-2">
              <Button as="a" href="/tracker" variant="outline" size="sm">
                Application tracker
              </Button>
              <Button as="a" href="/job-alerts" variant="outline" size="sm">
                Job alerts
              </Button>
              <Button as="a" href="/build" size="sm">
                Tailor a resume
              </Button>
            </div>}
          </div>

          {/* Popular country chips live in the header (non-sticky) so they never bloat the sticky bar */}
          {me?.loggedIn && <div className="jobs-country-chips mt-4" aria-label="Popular countries">
            {POPULAR_COUNTRIES.map((item) => (
              <button
                type="button"
                className={`jobs-country-chip ${country === item.code ? "active" : ""}`}
                aria-pressed={country === item.code}
                key={item.code}
                onClick={() => {
                  setCountry(item.code);
                  setPage(1);
                }}
              >
                <span>{flag(item.code)}</span>
                <span>{countryShortName(item)}</span>
              </button>
            ))}
          </div>}
        </div>
      </section>

      <section className="container jobs-results">
        {/* Compact 1-row sticky search & filter bar */}
        {me?.loggedIn && <div className="jobs-search-shell">
          <div className="jobs-search-panel" role="search">
            <label className="jobs-query">
              <span>Role, skill, or company</span>
              <input
                className="field"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Data analyst, React, Deloitte..."
              />
            </label>

            <Button
              variant="outline"
              className="jobs-filters-toggle"
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              Filters
            </Button>

            <div className={`jobs-filter-fields ${filtersOpen ? "open" : ""}`}>
              <label>
                <span>Country</span>
                <select
                  className="field"
                  aria-label="Country"
                  value={country}
                  onChange={(event) => {
                    setCountry(event.target.value);
                    setPage(1);
                  }}
                >
                  <optgroup label="Popular">
                    {POPULAR_SELECT_COUNTRIES.map((item) => (
                      <option value={item.code} key={`popular-${item.code}`}>
                        {flag(item.code)} {item.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All countries (A-Z)">
                    {OTHER_COUNTRIES_ALPHA.map((item) => (
                      <option value={item.code} key={`all-${item.code}`}>
                        {flag(item.code)} {item.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              {lockJobType ? (
                <label>
                  <span>Work type</span>
                  <span className="field readonly-field">Internship</span>
                </label>
              ) : (
                <label>
                  <span>Work type</span>
                  <select
                    className="field"
                    aria-label="Work type"
                    value={jobType}
                    onChange={(event) => {
                      setJobType(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All work types</option>
                    <option value="fulltime">Full-time</option>
                    <option value="parttime">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </label>
              )}

              <label className="jobs-remote">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(event) => {
                    setRemote(event.target.checked);
                    setPage(1);
                  }}
                />
                Remote only
              </label>

              <label>
                <span>Sort</span>
                <select
                  className="field"
                  aria-label="Sort results"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value === "salary" ? "salary" : "newest");
                    setPage(1);
                  }}
                >
                  <option value="newest">Newest</option>
                  <option value="salary">Salary</option>
                </select>
              </label>

              {(query.trim() || (!lockJobType && jobType) || remote || sort !== "newest") && (
                <Button type="button" variant="ghost" size="compact" onClick={resetFilters}>
                  ✕ Reset
                </Button>
              )}
            </div>
          </div>
        </div>}

        {!showGate && <div className="jobs-results-head">
          <div>
            <strong>
              {sessionError
                ? `${resultLabel[0].toUpperCase()}${resultLabel.slice(1)} search is unavailable`
                : showInitialLoading
                    ? "Searching..."
                    : isRefreshingPage1
                      ? `Updating ${total.toLocaleString()} ${resultLabel}…`
                      : `${total.toLocaleString()} fresh ${resultLabel}`}
            </strong>
            <span>
              {sessionError
                ? "Your filters are safe. Retry when your connection is ready."
                : `${freshness} from original job sources.`}
            </span>
          </div>
          <a href="/tracker">Open application tracker →</a>
        </div>}

        {query.trim().length >= 2 && !showGate && !sessionError && (
          <div className="flex flex-wrap items-center gap-2" style={{ margin: "0 0 8px" }}>
            {alertState === "created" ? (
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ margin: 0 }}>
                ✅ Weekly alert on for <strong>&ldquo;{query.trim().slice(0, 40)}&rdquo;</strong> in{" "}
                {selectedCountry.name}. Manage it under{" "}
                <a href="/job-alerts" className="font-semibold text-[var(--primary)] hover:underline">Job alerts</a>.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void createSearchAlert()}
                disabled={alertState === "creating"}
                isLoading={alertState === "creating"}
              >
                <Bell size={14} /> Alert me about new {resultLabel} like this
              </Button>
            )}
            {alertError && <p className="err" role="alert" style={{ margin: 0 }}>{alertError}</p>}
          </div>
        )}

        {showGate && (
          <div className="desk-jobs-access">
            <div className="desk-jobs-signin">
              <h2>Sign in to search {resultLabel}</h2>
              <p>Use a free account to search, save roles, and return to the resumes you tailored for them.</p>
              <a className="desk-button" href={loginUrl(pathname || "/jobs")}>Sign in or create an account</a>
            </div>
            <section className="desk-job-example" aria-labelledby="jobs-example-heading">
              <h2 id="jobs-example-heading">What a listing looks like</h2>
              <p className="desk-job-example-meta">Fictional listing · Remote, United States</p>
              <h3>{lockJobType ? "Product Management Intern" : "Product Manager, Onboarding"}</h3>
              <p>Harbor Labs · Help improve the trial experience through customer research and experiments.</p>
              <hr />
              <h3>What carries over to your resume</h3>
              <p>The role, company, and original job description.</p>
            </section>
          </div>
        )}

        {sessionError && (
          <div className="jobs-empty" role="alert">
            <Briefcase size={32} />
            <h2>We could not open job search</h2>
            <p>{sessionError}</p>
            <Button type="button" onClick={() => void refreshSession()}>
              Try again
            </Button>
          </div>
        )}

        {error && !showGate && <p className="err" role="alert">{error}</p>}
        {showInitialLoading && !showGate && !sessionError && <SkeletonRows />}

        {!showGate && !sessionError && !showInitialLoading && !error && jobs.length === 0 && (
          <div className="jobs-empty">
            <Briefcase size={32} />
            <h2>No matching {resultLabel} yet</h2>
            <p>{emptyRefreshLine}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button as="a" href="/jobs" variant="outline" size="sm">Switch country or search a role</Button>
              {query.trim() && (
                <Button type="button" variant="outline" size="sm" onClick={() => { setQuery(""); setPage(1); }}>
                  Clear &ldquo;{query.trim().slice(0, 24)}&rdquo;
                </Button>
              )}
            </div>
          </div>
        )}

        {!showGate && !sessionError && !showInitialLoading && jobs.length > 0 && (
          <>
            <div className="jobs-showing">Showing {showing.toLocaleString()} of {total.toLocaleString()}</div>
            {fuzzy && query.trim() && (
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ margin: "4px 0 0" }}>
                No exact matches for <strong>&ldquo;{query.trim().slice(0, 40)}&rdquo;</strong> — showing the closest
                titles instead. Check the spelling, or clear the search to browse everything.
              </p>
            )}
            {jobs.some((job) => job.reposted) && (
              <p className="text-[13px] text-[var(--muted-fg)]" style={{ margin: "4px 0 0" }}>
                <strong>Reposted</strong> marks a listing whose company already posted and delisted this same title here
                within 90 days. Reposts can mean a hard-to-fill role — or one that was never filled. It is a signal, not a verdict.
              </p>
            )}
            <div
              className={`jobs-list transition-opacity duration-150 ${
                isRefreshingPage1 ? "opacity-60 pointer-events-none" : "opacity-100"
              }`}
            >
              {jobs.map((job) => {
                const jobCountry = getCountryByCode(job.country_code);
                const salary = formatSalary(job);
                return (
                  <article className="job-row" key={job.id}>
                    <div className="job-row-avatar" aria-hidden="true">
                      {(job.company || "?").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="job-row-main">
                      <div className="job-row-top">
                        <div>
                          <div className="job-source">{job.provider.replaceAll("_", " ")}</div>
                          <h2>{job.title}</h2>
                          <p className="job-company">
                            {job.company} — {job.location || jobCountry?.name || selectedCountry.name} — {formatDate(job.posted_days_ago, job.date_posted)}
                          </p>
                        </div>
                        {salary && <span className="job-salary">{salary}</span>}
                      </div>

                      <div className="job-meta">
                        <span>{flag(job.country_code)} {jobCountry?.name || selectedCountry.name}</span>
                        {job.is_remote && <span>Remote</span>}
                        {job.job_type && <span>{jobTypeLabel(job.job_type)}</span>}
                        {fitBadges[job.id] && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${FIT_BADGE_STYLES[fitBadges[job.id].grade]}`}
                            title={`Your latest resume covers ${fitBadges[job.id].matched} of ${fitBadges[job.id].matched + fitBadges[job.id].missing} requirements in this posting.${fitBadges[job.id].topMissing.length ? ` Missing: ${fitBadges[job.id].topMissing.join(", ")}.` : ""} Same engine as the ATS checker.`}
                          >
                            Fit {fitBadges[job.id].fitScore} · {fitBadges[job.id].grade}
                          </span>
                        )}
                        {job.reposted && (
                          <span
                            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            title="This company has posted (and delisted) this same title here before."
                          >
                            Reposted
                          </span>
                        )}
                      </div>

                      {job.description_excerpt && (
                        <p className="job-excerpt">{job.description_excerpt}</p>
                      )}

                      <div className="job-actions">
                        <Button as="a" href={`/build#jobId=${job.id}`} size="sm">
                          <Target size={16} /> Tailor resume
                        </Button>
                        <Button
                          as="a"
                          href={`/resume-match?role=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
                          variant="outline"
                          size="sm"
                        >
                          📊 Check match
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveJob(job)}
                          disabled={saved[job.id]}
                          isLoading={savingJobId === job.id}
                        >
                          {saved[job.id] ? "✓ Saved" : "🔖 Save"}
                        </Button>
                        <a className="job-original" href={job.apply_url} target="_blank" rel="noopener noreferrer nofollow">
                          Original posting ↗
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className="jobs-load-more">
                <Button variant="outline" size="lg" disabled={loading && page > 1} isLoading={loading && page > 1} onClick={() => setPage((value) => value + 1)}>
                  {loading && page > 1 ? "Loading more..." : `Load more ${resultLabel}`}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
