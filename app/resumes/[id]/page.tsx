"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, Eyebrow, FieldError, GeneratedOutput, WorkspaceShell } from "@/components/ui/primitives";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LivePreview from "@/app/build/live-preview";
import { resumeContentToPreviewData } from "@/lib/resume-form/to-preview-data";
import { resumeSourceText } from "@/lib/resume-source-text";
import { scoreHumanAuthenticity } from "@/lib/ai-humanizer";
import type { ResumeContent } from "@/lib/types";
import ScoreRing from "@/components/ui/ScoreRing";
import Skeleton from "@/components/ui/Skeleton";
import { ArrowLeft, Download, FileText, Lock, Pencil, Trash, Sparkles, MessageSquare, Linkedin } from "../../icons";

// Lives at /resumes/[id], NOT /resume/[id]: app/resume/[company]/[role] already
// owns that segment, and Next refuses two different slug names at one level.

type Interview = { items?: { q: string; a: string }[] };

type Detail = {
  id: string;
  content: any;
  atsScore: number;
  candidateName: string;
  premiumUnlock: boolean;
  coverLetter: string | null;
  linkedin: string | null;
  interview: Interview | null;
};

type ToolKey = "cover" | "interview" | "linkedin";

const TOOLS: { key: ToolKey; title: string; blurb: string; icon: any; cta: string }[] = [
  { key: "cover", title: "Cover letter", blurb: "A letter built from this resume's own evidence — no invented claims.", icon: Sparkles, cta: "Write cover letter" },
  { key: "interview", title: "Interview prep", blurb: "Likely questions with answers grounded in your bullets.", icon: MessageSquare, cta: "Prepare answers" },
  { key: "linkedin", title: "LinkedIn About", blurb: "A first-person About section drawn from this resume.", icon: Linkedin, cta: "Write About section" },
];

// Premium feature: re-voice the cover letter for a different audience. The
// facts never change — only which ones lead and how they sound.
const TONES = [
  { id: "formal", label: "Formal", blurb: "Corporate, government, large companies." },
  { id: "warm", label: "Warm", blurb: "Startups, small teams, creative roles." },
  { id: "direct", label: "Direct", blurb: "Results first, for skimming screeners." },
] as const;
type CoverToneId = (typeof TONES)[number]["id"];

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<Detail | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<ToolKey | null>(null);
  const [toolErr, setToolErr] = useState<Partial<Record<ToolKey, string>>>({});
  const [needsUpgrade, setNeedsUpgrade] = useState<Partial<Record<ToolKey, boolean>>>({});
  // Premium tone picker for the cover letter. Formal is the default letter;
  // warm/direct are the paid re-voices.
  const [coverTone, setCoverTone] = useState<CoverToneId>("formal");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/resume/${id}`);
      if (r.status === 401) { router.push(`/login?next=/resumes/${id}`); return; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setLoadErr(r.status === 404 ? "That resume no longer exists." : j.error || "Could not load this resume."); return; }
      setData(j);
      setLoadErr("");
    } catch {
      setLoadErr("Network error — could not load this resume.");
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);

  // Deep link from the saved-resume list: /resumes/<id>?tool=cover starts the
  // letter on arrival, so "one click from a saved resume" is one click rather
  // than open, find the card, click again. Read from location rather than
  // useSearchParams to keep this out of a Suspense boundary.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !data) return;
    const requested = new URLSearchParams(window.location.search).get("tool");
    if (!requested || !TOOLS.some((tool) => tool.key === requested)) return;
    autoRan.current = true;
    // Regenerating something already written would burn an allowance for a
    // result the user can already see.
    if (resultFor(requested as ToolKey)) return;
    void runTool(requested as ToolKey);
    // runTool and resultFor are recreated every render; depending on them here
    // would re-fire the generation on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const premium = !!(me?.premium || data?.premiumUnlock);
  // Mirrors /api/resume/[id]/docx: DOCX is the Platform Premium tier feature;
  // a per-resume unlock covers FREE accounts only, so a student's unlocked
  // resume stays PDF-only (lib/tier-features.ts).
  const docxAllowed = !!me?.features?.docxExport || (!me?.premium && !!data?.premiumUnlock);

  async function runTool(key: ToolKey, tone?: CoverToneId) {
    if (busy) return;
    setBusy(key);
    setToolErr((e) => ({ ...e, [key]: "" }));
    setNeedsUpgrade((u) => ({ ...u, [key]: false }));
    try {
      const body: Record<string, unknown> = { resumeId: id };
      // Tone only applies to the cover letter; a non-formal tone is always
      // sent explicitly so the server regenerates instead of returning the
      // memoized formal letter.
      if (key === "cover" && tone && tone !== "formal") body.tone = tone;
      else if (key === "cover" && tone === "formal" && data?.coverLetter && coverTone !== "formal") body.tone = "formal";
      const r = await fetch(`/api/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 402) { setNeedsUpgrade((u) => ({ ...u, [key]: true })); return; }
      if (!r.ok) { setToolErr((e) => ({ ...e, [key]: j.error || `Could not generate (HTTP ${r.status}).` })); return; }
      setData((d) => (d ? { ...d, ...(key === "cover" ? { coverLetter: j.coverLetter } : key === "linkedin" ? { linkedin: j.linkedin } : { interview: j.interview }) } : d));
    } catch {
      setToolErr((e) => ({ ...e, [key]: "Network error — nothing was generated." }));
    } finally {
      setBusy(null);
    }
  }

  function resultFor(key: ToolKey): string | null {
    if (!data) return null;
    if (key === "cover") return data.coverLetter;
    if (key === "linkedin") return data.linkedin;
    const items = data.interview?.items;
    return items?.length ? items.map((i) => `Q: ${i.q}\nA: ${i.a}`).join("\n\n") : null;
  }

  async function remove() {
    try {
      const r = await fetch(`/api/resume/${id}`, { method: "DELETE" });
      if (!r.ok) { setLoadErr(`Delete failed (HTTP ${r.status}).`); return; }
      router.push("/dashboard");
    } catch {
      setLoadErr("Network error — the resume was not deleted.");
    }
  }

  // WorkspaceShell with showHeader={false}: this page owns its header because
  // the score ring sits beside the title, which PageHeader has no slot for. The
  // shell still supplies the main landmark, the page rhythm and the container,
  // so the three branches below stop hand-rolling all three — and stop setting
  // a background the body already sets.
  if (loadErr) {
    return (
      <WorkspaceShell showHeader={false}>
        <Card padding="lg" className="text-center">
          <h1 className="text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{loadErr}</h1>
          <div className="mt-6"><Button as="a" href="/dashboard" leftIcon={<ArrowLeft size={16} />}>Back to my resumes</Button></div>
        </Card>
      </WorkspaceShell>
    );
  }

  if (!data) {
    return (
      <WorkspaceShell showHeader={false}>
        <Skeleton className="h-40 w-full" />
      </WorkspaceShell>
    );
  }

  const c = data.content || {};

  return (
    <WorkspaceShell showHeader={false}>
      <>
        <a href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] dark:text-[var(--color-dark-text-muted)]">
          <ArrowLeft size={15} /> My resumes
        </a>

        <header className="mt-4 grid min-w-0 gap-5">
          <div className="flex items-center gap-5 min-w-0">
            <div className="shrink-0"><ScoreRing score={data.atsScore} size={72} stroke={8} label="ATS" /></div>
            <div className="min-w-0">
              <Eyebrow>Resume</Eyebrow>
              <h1 className="break-words text-3xl font-bold! text-[var(--fg)]">{data.candidateName}</h1>
              <p className="break-words text-[var(--muted-fg)]">{c.headline || "Tailored resume"}</p>
              {(() => {
                try {
                  const human = scoreHumanAuthenticity(resumeSourceText(c as ResumeContent));
                  return human.humanScore >= 85 ? (
                    <Badge variant="success" title={`Human score ${human.humanScore}% · burstiness ${human.burstiness}`}>
                      Writing variation score: {human.humanScore}%
                    </Badge>
                  ) : null;
                } catch { return null; }
              })()}
            </div>
          </div>
          <div role="group" aria-label="Resume actions" className="flex flex-wrap items-center gap-2 border-y border-[var(--border)] py-3">
            <Button as="a" href={`/build?resumeId=${data.id}`} variant="outline" leftIcon={<Pencil size={15} />} title="Open this resume in the AI builder with every field pre-filled">Edit in AI Builder</Button>
            <Button as="a" href={`/resume-maker?resumeId=${data.id}`} variant="outline" leftIcon={<Pencil size={15} />} title="Open this resume in the visual maker">Edit in Visual Maker</Button>
            <Button as="a" href={`/api/resume/${data.id}/pdf`} leftIcon={<Download size={15} />}>PDF</Button>
            {docxAllowed ? (
              <Button as="a" href={`/api/resume/${data.id}/docx`} variant="outline" leftIcon={<FileText size={15} />}>DOCX</Button>
            ) : (
              <Button
                as="a"
                href="/pricing"
                variant="outline"
                leftIcon={<Lock size={15} />}
                title={me?.premiumSource === "student" ? "DOCX export comes with Platform Premium — your Student plan includes clean, watermark-free PDF" : "DOCX is a Premium feature"}
              >DOCX (Premium)</Button>
            )}
            <Button as="a" href={`/api/resume/${data.id}/txt`} variant="outline" size="sm" title="Plain text for portals that only accept pasted text">TXT</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete this resume"><Trash size={15} /></Button>
          </div>
        </header>

        {/* The document itself, rendered by the same component /build previews
            with. Before this the only way to see the real layout was to
            download the PDF and open it — and for a free account that download
            is watermarked and forced to the basic template, so it does not even
            show what the export would look like. The section breakdown below
            stays: it is the readable form, this is the shape. */}
        <Card padding="lg" className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold! text-[var(--fg)]">Document preview</h2>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
          </div>
          <div className="resume-detail-preview overflow-x-auto">
            <LivePreview data={resumeContentToPreviewData(c as ResumeContent, data.candidateName || "")} />
          </div>
        </Card>

        {/* Resume content — previously unreachable once you left /build. */}
        <Card padding="lg" className="mt-8">
          {c.summary && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Summary</h2>
              <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{c.summary}</p>
            </section>
          )}

          {!!c.skills?.length && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {c.skills.map((s: string, i: number) => <Badge key={`${s}-${i}`} variant="primary">{s}</Badge>)}
              </div>
            </section>
          )}

          {!!c.experiences?.length && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Experience</h2>
              {c.experiences.map((e: any, i: number) => (
                <div key={i} className="mb-5 last:mb-0">
                  <p className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{e.title}{e.company ? ` — ${e.company}` : ""}</p>
                  {e.period && <p className="text-sm text-[var(--color-text-faint)]">{e.period}</p>}
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                    {(e.bullets || []).map((b: string, bi: number) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {!!c.education?.length && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Education</h2>
              {c.education.map((e: any, i: number) => (
                <p key={i} className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="font-semibold">{e.degree}</span>{e.school ? ` — ${e.school}` : ""}{e.year ? ` — ${e.year}` : ""}
                </p>
              ))}
            </section>
          )}

          {!!c.projects?.length && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Projects</h2>
              {c.projects.map((p: any, i: number) => (
                <p key={i} className="mb-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]"><span className="font-semibold">{p.name}</span> — {p.detail}</p>
              ))}
            </section>
          )}

          {!!c.achievements?.length && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Achievements</h2>
              <ul className="list-disc space-y-1 pl-5 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                {c.achievements.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {(!!c.certifications?.length || !!c.languages?.length) && (
            <section className="flex flex-wrap gap-x-10 gap-y-4">
              {!!c.certifications?.length && (
                <div>
                  <h2 className="mb-2 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Certifications</h2>
                  <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{c.certifications.join(", ")}</p>
                </div>
              )}
              {!!c.languages?.length && (
                <div>
                  <h2 className="mb-2 text-sm font-bold! uppercase tracking-wide text-[var(--color-text-muted)]">Languages</h2>
                  <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{c.languages.join(", ")}</p>
                </div>
              )}
            </section>
          )}
        </Card>

        {/* The three Premium tools the pricing page sells. These APIs shipped
            working but had no caller anywhere in the app until now. */}
        <section className="mt-10">
          <Eyebrow>Premium tools</Eyebrow>
          <h2 className="mb-1 text-2xl font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Built from this resume</h2>
          <p className="mb-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Each one reads the resume above, so the wording stays consistent with what you send.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const result = resultFor(t.key);
              return (
                <Card key={t.key} padding="md" className="flex flex-col">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon size={18} />
                    <h3 className="text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{t.title}</h3>
                    {!premium && <Badge variant="premium">Premium</Badge>}
                  </div>
                  <p className="mb-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{t.blurb}</p>

                  {/* Premium tone picker (cover letter only): re-voices the
                      same evidence for a different audience. Free users never
                      reach this card's generate at all, so no extra gate here. */}
                  {t.key === "cover" && premium && (
                    <div className="mb-4 grid grid-cols-3 gap-1 rounded-[var(--radius)] bg-[var(--color-surface-2)] p-1 dark:bg-[var(--color-dark-surface-2)]" role="group" aria-label="Cover letter tone">
                      {TONES.map((tone) => (
                        <button
                          key={tone.id}
                          type="button"
                          aria-pressed={coverTone === tone.id}
                          title={tone.blurb}
                          onClick={() => setCoverTone(tone.id)}
                          className={`rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${
                            coverTone === tone.id
                              ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm dark:bg-[var(--color-dark-surface)]"
                              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] dark:text-[var(--color-dark-text-muted)] dark:hover:text-[var(--color-dark-text)]"
                          }`}
                        >
                          {tone.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {result ? (
                    <GeneratedOutput
                      label={t.title}
                      text={result}
                      actions={
                        <>
                          {t.key === "cover" && premium && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => runTool("cover", coverTone)}
                              isLoading={busy === "cover"}
                              disabled={!!busy}
                              title={TONES.find((x) => x.id === coverTone)?.blurb}
                            >
                              Rewrite as {TONES.find((x) => x.id === coverTone)?.label}
                            </Button>
                          )}
                        </>
                      }
                    />
                  ) : needsUpgrade[t.key] ? (
                    <div className="mt-auto">
                      <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t.title} is part of Premium.</p>
                      <Button as="a" href="/pricing" size="sm">Upgrade to unlock</Button>
                    </div>
                  ) : (
                    <div className="mt-auto">
                      <Button size="sm" onClick={() => runTool(t.key, t.key === "cover" ? coverTone : undefined)} isLoading={busy === t.key} disabled={!!busy}>
                        {busy === t.key ? "Working…" : t.cta}
                      </Button>
                    </div>
                  )}

                  <FieldError>{toolErr[t.key]}</FieldError>
                </Card>
              );
            })}
          </div>
        </section>
        {confirmDelete && (
          <ConfirmDialog
            title="Delete this resume?"
            body="The resume, its score, and any generated cover letter go with it. This cannot be undone."
            confirmLabel="Delete resume"
            destructive
            onConfirm={async () => { setConfirmDelete(false); await remove(); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </>
    </WorkspaceShell>
  );
}
