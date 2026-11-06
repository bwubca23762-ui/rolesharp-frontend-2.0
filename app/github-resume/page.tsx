"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, ToolShell } from "@/components/ui/primitives";
import { FaqSection } from "@/app/seo-blocks";
import { useWorkspaceDraft } from "@/lib/workspace-context";
import {
  compileStructuredResumeToAtsText,
  exportToJsonResume,
  exportToRenderCvYaml,
  importFromJsonResume,
} from "@/lib/json-resume-bridge";
import type { ResumeContent } from "@/lib/types";

type GitHubProject = {
  name: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  bullet: string;
};

type GitHubResult = {
  profile: { login: string; name: string; bio: string; publicRepos: number; followers: number; htmlUrl: string };
  stats: { publicRepos: number; totalStars: number; totalForks: number; languages: Array<{ name: string; repos: number }>; topics: string[]; suggestedSkills: string[] };
  projects: GitHubProject[];
};

const FAQS: [string, string][] = [
  ["Are the project bullets AI-written?", "No. Every number in a bullet comes straight from the GitHub REST API — stars, forks, primary language, repository description. The tool assembles those facts into XYZ bullet shape; it never invents a metric. You edit every bullet before it goes anywhere."],
  ["What is resume.json?", "The open JSON Resume standard (jsonresume.org) — a portable resume format dozens of themes and tools render. Reactive Resume exports the same shape, so you can import an existing resume from either without retyping, and export your RoleSharp resume back out at any time."],
  ["Why RenderCV YAML?", "RenderCV renders your CV from a YAML file you commit to a Git repository — version control for your resume, like code. The export keeps your dates at the precision your resume had: a year stays a year, never padded into a fake month."],
];

export default function GithubResumePage() {
  const { updateDraft } = useWorkspaceDraft();
  const [username, setUsername] = useState("");
  const [gh, setGh] = useState<GitHubResult | null>(null);
  const [projectBullets, setProjectBullets] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importJson, setImportJson] = useState("");
  const [exportTab, setExportTab] = useState<"json" | "yaml" | "text">("json");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState("");

  const exportPayload = useMemo(() => {
    if (!content) return "";
    if (exportTab === "json") return JSON.stringify(exportToJsonResume(content, name || "Candidate"), null, 2);
    if (exportTab === "yaml") return exportToRenderCvYaml(content, name || "Candidate");
    return compileStructuredResumeToAtsText(content);
  }, [content, exportTab, name]);

  const exportExt = exportTab === "json" ? "json" : exportTab === "yaml" ? "yaml" : "txt";

  async function compile() {
    const handle = username.trim().replace(/^@/, "");
    if (!handle || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/tools/github-import?username=${encodeURIComponent(handle)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not compile that profile.");
      setGh(j as GitHubResult);
      setName(j.profile.name || j.profile.login);
      const bullets: Record<string, string> = {};
      for (const p of (j as GitHubResult).projects) bullets[p.name] = p.bullet;
      setProjectBullets(bullets);
      mergeIntoContent(j as GitHubResult, bullets);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not compile that profile.");
    } finally {
      setBusy(false);
    }
  }

  function mergeIntoContent(result: GitHubResult, bullets: Record<string, string>) {
    const keep = result.projects.filter((p) => (bullets[p.name] ?? "").trim());
    const summaryFromBio = result.profile.bio?.trim()
      ? `${result.profile.bio.trim()}${result.profile.bio.trim().endsWith(".") ? "" : "."}`
      : `Open-source engineer with ${result.stats.publicRepos} public repositories and ${result.stats.totalStars.toLocaleString("en-US")} GitHub stars.`;
    setContent({
      headline: `Developer — ${result.stats.languages.slice(0, 3).map((l) => l.name).join(", ")}` || "Developer",
      summary: summaryFromBio.slice(0, 4000),
      skills: result.stats.suggestedSkills.slice(0, 100),
      experiences: [],
      education: [],
      projects: keep.map((p) => ({ name: p.name, detail: (bullets[p.name] ?? "").slice(0, 4000) })),
      certifications: [],
      languages: [],
      achievements: [],
    });
    setWarnings(result.stats.languages.length > 8 ? ["Only the top languages made the skills list (100-item cap)."] : []);
  }

  function rerenderBullet(projectName: string, value: string) {
    setProjectBullets((prev) => {
      const next = { ...prev, [projectName]: value };
      if (gh) mergeIntoContent(gh, next);
      return next;
    });
  }

  function runImport() {
    setErr("");
    setWarnings([]);
    try {
      const parsed = JSON.parse(importJson);
      const result = importFromJsonResume(parsed);
      setContent(result.content);
      setWarnings(result.warnings);
      setName((current) => current || "Imported candidate");
    } catch (e: unknown) {
      setErr(e instanceof Error ? `That file did not parse as JSON Resume: ${e.message}` : "That file did not parse as JSON Resume.");
    }
  }

  function copyExport() {
    if (!exportPayload) return;
    navigator.clipboard?.writeText(exportPayload).then(() => {
      setCopied(exportTab);
      setTimeout(() => setCopied(""), 2000);
    }).catch(() => {});
  }

  function downloadExport() {
    if (!exportPayload) return;
    const blob = new Blob([exportPayload], { type: exportTab === "yaml" ? "text/yaml" : exportTab === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportTab === "json" ? "resume.json" : exportTab === "yaml" ? "cv.yaml" : "resume-ats.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function pushToMaker() {
    if (!content) return;
    const bullets = [
      ...(content.projects ?? []).map((p) => p.detail).filter(Boolean),
      ...(content.experiences ?? []).flatMap((e) => e.bullets),
    ].slice(0, 24);
    try {
      sessionStorage.setItem("rolesharp-maker-import", JSON.stringify({ tool: "bullets", bullets }));
    } catch {}
    window.location.href = "/resume-maker";
  }

  function pushToChecker() {
    if (!content) return;
    updateDraft(
      { resumeText: compileStructuredResumeToAtsText(content), resumeFileName: "github-resume.json", origin: "github-resume" },
      "github-resume",
    );
    window.location.href = "/checker";
  }

  // The /build page restores its own device-local draft on mount (same
  // contract its autosave writes: fields + { version: 1, savedAt }). Writing
  // that key directly is the real one-click handoff — the builder opens with
  // every field pre-filled instead of a draft it never reads.
  function pushToBuild() {
    if (!content) return;
    const experiences = content.experiences.map((e, i) => {
      const parts = (e.period ?? "").split(/\s[-–—]\s/);
      const start = (parts[0] ?? "").trim();
      const endRaw = (parts[1] ?? "").trim();
      return {
        id: `gh-${i}-${Date.now()}`,
        title: e.title,
        company: e.company,
        location: "",
        start,
        end: /^(present|current|now)$/i.test(endRaw) ? "" : endRaw,
        current: /^(present|current|now)$/i.test(endRaw),
        bullets: e.bullets,
      };
    });
    const buildDraft = {
      name: name || "Candidate",
      email: content.contact?.email ?? "",
      phone: content.contact?.phone ?? "",
      city: content.contact?.location ?? "",
      stateRegion: "",
      country: "",
      countryCode: "",
      careerLevel: "",
      linkedin: content.contact?.linkedin ?? "",
      links: (content.contact?.links ?? []).join(", "),
      summary: content.summary,
      skills: content.skills.join(", "),
      experiences,
      edu: content.education.map((ed) => [ed.degree, ed.school, ed.year ?? ""].filter(Boolean).join(" | ")).join("\n"),
      projects: (content.projects ?? []).map((p) => `${p.name}: ${p.detail}`).join("\n"),
      certs: (content.certifications ?? []).join(", "),
      languages: (content.languages ?? []).join(", "),
      achievements: (content.achievements ?? []).join("\n"),
      jd: "",
      roleQ: "",
      companyQ: "",
      template: "basic",
      version: 1,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("rolesharp-build-draft", JSON.stringify(buildDraft));
    } catch {}
    window.location.href = "/build";
  }

  return (
    <ToolShell
      eyebrow="Free — no account"
      title="GitHub & JSON Resume Compiler"
      subtitle="Turn any public GitHub profile into ATS project bullets from real repository facts, then move the result in and out of resume.json and RenderCV YAML."
      workspaceSize="large"
      onReset={() => { setGh(null); setContent(null); setImportJson(""); setWarnings([]); setErr(""); }}
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* PANEL 1: GITHUB COMPILER */}
        <Card className="lg:col-span-6">
          <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
            1-click GitHub compiler
          </span>
          <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">Repositories → evidence bullets</h2>
          <p className="mt-1 text-sm text-[var(--muted-fg)]">
            Reads public profile and top non-fork repos through the GitHub REST API. Stars, forks, and languages come from the API — never invented.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="min-w-[220px] flex-1">
              <span className="sr-only">GitHub username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void compile(); }}
                placeholder="github username (e.g. torvalds)"
                maxLength={39}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted-fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </label>
            <Button onClick={() => void compile()} isLoading={busy} disabled={!username.trim()}>
              ⚡ Compile profile
            </Button>
          </div>
          {err && <p className="mt-2 text-sm font-semibold text-[var(--color-danger)]" role="alert">{err}</p>}

          {gh && (
            <div className="mt-4 space-y-3" role="status">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center">
                  <p className="text-lg font-extrabold! text-[var(--fg)]">{gh.stats.publicRepos}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-fg)]">Public repos</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center">
                  <p className="text-lg font-extrabold! text-[var(--fg)]">{gh.stats.totalStars.toLocaleString("en-US")}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-fg)]">Total stars</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center">
                  <p className="text-lg font-extrabold! text-[var(--fg)]">{gh.stats.totalForks.toLocaleString("en-US")}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-fg)]">Total forks</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {gh.stats.languages.slice(0, 6).map((l) => (
                  <Badge key={l.name} variant="default">{l.name} ×{l.repos}</Badge>
                ))}
                {gh.stats.topics.slice(0, 6).map((t) => (
                  <Badge key={t} variant="primary">{t}</Badge>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">
                  Top {gh.projects.length} projects — every bullet is editable and uses only API facts
                </p>
                {gh.projects.map((p) => (
                  <div key={p.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[var(--primary)] hover:underline">
                        {p.name}
                      </a>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-fg)]">
                        {p.language ?? "—"} · ★ {p.stars.toLocaleString("en-US")} · fork {p.forks.toLocaleString("en-US")}
                      </span>
                    </div>
                    <textarea
                      value={projectBullets[p.name] ?? ""}
                      onChange={(e) => rerenderBullet(p.name, e.target.value)}
                      rows={2}
                      maxLength={4000}
                      aria-label={`${p.name} resume bullet`}
                      className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[13px] leading-5 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* PANEL 2: BRIDGE */}
        <Card className="lg:col-span-6 lg:sticky lg:top-24">
          <span className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
            resume.json & RenderCV bridge
          </span>
          <h2 className="mt-1.5 text-lg font-extrabold! text-[var(--fg)]">Import · Export · Handoff</h2>

          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Import an existing resume.json</p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={3}
              maxLength={200_000}
              placeholder='Paste a JSON Resume or Reactive Resume export: {"basics": {"name": …}, "work": […]}'
              aria-label="Paste resume.json"
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[family-name:var(--font-mono)] text-[12px] leading-5 text-[var(--fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--muted-fg)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]">
                📎 Upload .json
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void file.text().then((text) => setImportJson(text));
                  }}
                />
              </label>
              <Button type="button" variant="outline" size="compact" disabled={importJson.trim().length < 2} onClick={runImport}>
                ⬇ Import into the bridge
              </Button>
            </div>
          </div>

          {content && (
            <div className="mt-3" role="status">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-fg)]">Export</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["json", "resume.json"], ["yaml", "RenderCV.yaml"], ["text", "ATS plain text"]] as const).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={exportTab === key ? "primary" : "outline"}
                      size="compact"
                      onClick={() => setExportTab(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <textarea
                readOnly
                value={exportPayload}
                rows={10}
                aria-label="Export output"
                className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-2 font-[family-name:var(--font-mono)] text-[12px] leading-5 text-[var(--fg)]"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="compact" onClick={copyExport}>
                    {copied === exportTab ? "✓ Copied" : "📋 Copy"}
                  </Button>
                  <Button type="button" variant="outline" size="compact" onClick={downloadExport}>
                    ⬇ Download .{exportExt}
                  </Button>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Full name for exports"
                  placeholder="Full name for the header"
                  maxLength={120}
                  className="min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted-fg)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              {warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] leading-4 text-[var(--muted-fg)]">
                  {warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-3">
                <Button type="button" size="sm" onClick={pushToBuild}>
                  ✨ Push into AI Builder →
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={pushToChecker}>
                  📊 Score in Checker →
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={pushToMaker}>
                  🛠 Open in Maker
                </Button>
              </div>
            </div>
          )}

          {!content && (
            <p className="mt-3 text-sm text-[var(--muted-fg)]">
              Compile a GitHub profile above or import a <strong>resume.json</strong> — the export tabs appear once there is content to move.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <FaqSection visible heading="Common questions" faqs={FAQS} />
      </div>
    </ToolShell>
  );
}
