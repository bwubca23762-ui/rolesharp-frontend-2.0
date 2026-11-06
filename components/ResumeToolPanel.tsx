"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/app/session-context";
import SocialRewardModal from "@/components/SocialRewardModal";
import { Button, Card, GeneratedOutput, Input, Label, Select, EmptyState } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import PracticeSession from "@/components/interview/PracticeSession";
import PanelSimulator from "@/components/interview/PanelSimulator";
import Battlecard from "@/components/interview/Battlecard";
import { FileText, Lock, MessageSquare } from "@/app/icons";

/**
 * Runs a Premium resume derivative (cover letter, interview prep) against a
 * resume the user already saved.
 *
 * Both /api/cover and /api/interview key off `resumeId` — they read the stored
 * resume content rather than accepting pasted text — so the entry point has to
 * be "pick one of your resumes", not a blank textarea. Previously these
 * endpoints were only reachable from the /build result panel, which meant the
 * landing pages that rank for this intent had no way into the feature.
 */

type SavedResume = {
  id: string;
  candidate_name: string | null;
  headline: string | null;
  company_name: string | null;
  role_title: string | null;
  created_at: string;
};

type InterviewItem = { q: string; a: string };

type StarEntry = {
  question: string;
  experienceTitle: string;
  company: string;
  bullet: string;
  hasMetric: boolean;
  situation: string;
  action: string;
  resultPrompt: string;
};

/** Requests can sit behind a cold model; give up before the user assumes a hang. */
const REQUEST_TIMEOUT_MS = 60_000;

export default function ResumeToolPanel({
  kind,
  heading,
  description,
  actionLabel,
}: {
  kind: "cover" | "interview";
  heading: string;
  description: string;
  actionLabel: string;
}) {
  const [resumes, setResumes] = useState<SavedResume[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [authState, setAuthState] = useState<"unknown" | "in" | "out">("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [interview, setInterview] = useState<InterviewItem[]>([]);
  // Interactive practice session (VOICE-INTERVIEW-PLAN V-1) — issued by the
  // interview route for both tiers; null until a session is created.
  const [practice, setPractice] = useState<{ id: string; tier: "free" | "premium"; questionCount: number } | null>(null);
  const [star, setStar] = useState<StarEntry[]>([]);
  const [copied, setCopied] = useState(false);
  // Optional target override for cover letters: tailor to a company/role the
  // resume wasn't originally built for. Empty = use the resume's saved target.
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // The panel used to learn whether anyone was signed in by calling
  // /api/resumes and reading the 401. It handled that correctly, but the
  // browser still logs every 401 as a failed resource, so both public landing
  // pages that mount this shipped a console error and a wasted round-trip to
  // every logged-out visitor -- the only thing keeping `npm run audit:ui` red.
  // The session provider above already knows, from a call that returns 200 with
  // loggedIn: false, so ask it and skip the request entirely.
  const { session, loading: sessionLoading, refreshSession } = useSession();
  // Credit bridge (follow-event / referral credits): a free user with credits
  // can buy a full premium interview session per credit.
  const isInterviewPanel = kind === "interview";
  const credits = Number(session?.credits ?? 0);
  const interviewCreditsHint = isInterviewPanel && !session?.premium && credits > 0
    ? `${credits} credit${credits === 1 ? "" : "s"} available — 1 credit = 1 full premium session`
    : "";
  const signedIn = session?.loggedIn ?? false;

  useEffect(() => {
    if (sessionLoading) return;
    if (!signedIn) {
      setAuthState("out");
      setResumes([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/resumes", { signal: controller.signal, cache: "no-store" });
        // Still handled: a session can lapse between /api/me and this call.
        if (response.status === 401) { setAuthState("out"); setResumes([]); return; }
        if (!response.ok) throw new Error("list_failed");
        const rows = (await response.json()) as SavedResume[];
        setAuthState("in");
        setResumes(Array.isArray(rows) ? rows : []);
        if (Array.isArray(rows) && rows[0]) setSelectedId(rows[0].id);
      } catch {
        if (controller.signal.aborted) return;
        setAuthState("in");
        setResumes([]);
        setError("We could not load your saved resumes. Refresh and try again.");
      }
    })();
    return () => controller.abort();
  }, [sessionLoading, signedIn]);

  // Abandoning the page must not leave a generation request running.
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(async (opts?: { forceCredit?: boolean }) => {
    if (!selectedId || busy) return;
    setBusy(true);
    setError("");
    setNeedsUpgrade(false);
    setUpgradeMessage("");
    setCoverLetter("");
    setInterview([]);
    setPractice(null);
    setStar([]);
    setCopied(false);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedId,
          ...(kind === "interview" && (useCredit || opts?.forceCredit === true) ? { useCredit: true } : {}),
          ...(kind === "cover" && (targetCompany.trim() || targetRole.trim())
            ? { company: targetCompany.trim() || undefined, role: targetRole.trim() || undefined }
            : {}),
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 402) {
        if (data.error === "no_credits" || (data.error === "limit_reached" && data.canUseCredit === false)) {
          setNeedsUpgrade(true);
          setUpgradeMessage(kind === "interview"
            ? data.error === "no_credits"
              ? "You do not have a credit for a full session. Earn credits or choose a Premium pass."
              : "You have used this month’s free practice session. Earn a credit for a full session, choose Premium, or come back next month."
            : "Unlock this feature for this resume, or upgrade to use it on every resume you make.");
        } else if (data.error === "limit_reached" && data.canUseCredit) {
          // The user HAS credits — surface the credit bridge instead of a paywall.
          setUseCredit(true);
          setError("");
        } else {
          setNeedsUpgrade(true);
          setUpgradeMessage("Unlock this feature for this resume, or upgrade to use it on every resume you make.");
        }
        return;
      }
      if (response.status === 429) { setError("Too many requests. Wait a moment and try again."); return; }
      if (!response.ok || data.error) {
        setError(response.status === 502
          ? "The generator is busy right now. Please try again in a moment."
          : "We could not generate that. Please try again.");
        return;
      }
      if (kind === "interview") {
        setInterview((data.interview?.items ?? []) as InterviewItem[]);
        setStar(Array.isArray(data.interview?.star?.entries) ? (data.interview.star.entries as StarEntry[]) : []);
        setPractice(data.session ?? null);
        if (data.session?.creditSpent) void refreshSession();
      }
      else setCoverLetter(String(data.coverLetter ?? ""));
    } catch {
      setError(controller.signal.aborted
        ? "That took too long. Please try again."
        : "Network error. Please try again.");
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }, [kind, selectedId, busy, targetCompany, targetRole, useCredit, refreshSession]);

  async function copyResult() {
    const text = kind === "interview"
      ? interview.map((item, index) => `Q${index + 1}. ${item.q}\n${item.a}`).join("\n\n")
      : coverLetter;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying failed. Select the text and copy manually.");
    }
  }

  const icon = kind === "interview" ? <MessageSquare size={26} /> : <FileText size={26} />;
  const toolNoun = kind === "interview" ? "interview prep" : "the cover letter generator";

  if (resumes === null) {
    // Same shape as the loaded card so the swap causes no layout shift.
    return <Skeleton variant="card" height="12rem" />;
  }

  if (authState === "out") {
    return (
      <EmptyState
        icon={icon}
        title={`Log in to use ${toolNoun}`}
        description={`${description} Build a resume first — it takes a couple of minutes and stays in your account.`}
        actions={<>
          <Button as="a" href="/build" size="lg">Build a resume — free</Button>
          <Button as="a" href="/login" variant="outline" size="lg">Log in</Button>
        </>}
      />
    );
  }

  if (!resumes.length) {
    return (
      <EmptyState
        icon={icon}
        title="No saved resumes yet"
        description={`${heading} works from a resume you already made. Build one first and it will show up here.`}
        actions={<Button as="a" href="/build" size="lg">Build a resume — free</Button>}
      />
    );
  }

  const label = (resume: SavedResume) => {
    const target = [resume.company_name, resume.role_title].filter(Boolean).join(" — ");
    const made = new Date(resume.created_at).toLocaleDateString();
    return `${target || resume.headline || resume.candidate_name || "Resume"} — ${made}`;
  };

  return (
    <Card padding="lg">
      <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{description}</p>

      <div className="mt-6">
        <Label htmlFor="resume-tool-pick">Which resume?</Label>
        <Select
          id="resume-tool-pick"
          value={selectedId}
          disabled={busy}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setPractice(null);
            setInterview([]);
            setStar([]);
            setCoverLetter("");
            setError("");
            setNeedsUpgrade(false);
          }}
        >
          {resumes.map((resume) => <option key={resume.id} value={resume.id}>{label(resume)}</option>)}
        </Select>
      </div>

      {kind === "cover" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cover-target-company">Target company (optional)</Label>
            <Input
              id="cover-target-company"
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder="e.g. Acme Corp"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="cover-target-role">Target role (optional)</Label>
            <Input
              id="cover-target-role"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              placeholder="e.g. Senior Product Designer"
              maxLength={120}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void generate()} isLoading={busy} size="lg">{actionLabel}</Button>
        {isInterviewPanel && !session?.premium && credits > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => void generate({ forceCredit: true })}
            disabled={busy}
            title="Spend 1 credit for this full premium session — every question, STAR coaching, and AI voice evaluation"
          >
            Full session — use 1 credit
          </Button>
        )}
        {(coverLetter || interview.length > 0) && (
          <Button variant="outline" size="lg" onClick={() => void copyResult()}>{copied ? "Copied" : "Copy"}</Button>
        )}
      </div>
      {interviewCreditsHint && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]" role="status">{interviewCreditsHint}</p>
      )}

      {error && <p className="err mt-4" role="alert">{error}</p>}

      {needsUpgrade && (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]" role="status">
          <p className="flex items-center gap-2 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            <Lock size={16} aria-hidden /> {kind === "interview" ? "Your free practice allowance is used" : `${heading} is a Premium feature`}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            {upgradeMessage}
          </p>
          <div className="mt-4"><Button as="a" href="/pricing">See pricing</Button></div>
          {isInterviewPanel && (
            <div className="mt-4">
              <SocialRewardModal compact />
            </div>
          )}
        </div>
      )}

      {coverLetter && (
        <div className="mt-6" role="status" aria-live="polite">
          <GeneratedOutput label="Your cover letter" text={coverLetter} />
        </div>
      )}

      {interview.length > 0 && practice && (
        <PracticeSession
          key={practice.id}
          resumeId={selectedId}
          sessionId={practice.id}
          tier={practice.tier}
          questions={interview.map((item) => item.q)}
          star={star}
        />
      )}

      {interview.length > 0 && practice && (
        <details className="mt-4 rounded-xl border border-[var(--color-border)] p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Practice with three interviewer perspectives</summary>
        <PanelSimulator key={practice.id} resumeId={selectedId} questions={interview.map((item) => item.q)} />
        </details>
      )}

      {interview.length > 0 && practice && (
        <details className="mt-3 rounded-xl border border-[var(--color-border)] p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Build an interview evidence card</summary>
        <Battlecard key={practice.id} resumeId={selectedId} />
        </details>
      )}

      {interview.length > 0 && (
        <details className="mt-3 rounded-xl border border-[var(--color-border)] p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">Review all questions and evidence</summary>
          <ol className="space-y-4">
            {interview.map((item, index) => (
              <li key={item.q} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)]">
                <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Q{index + 1}. {item.q}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{item.a}</p>
              </li>
            ))}
          </ol>
          {star.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">STAR scaffolds — your own evidence</h4>
              <ul className="space-y-3">
                {star.map((entry) => (
                  <li key={entry.question} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-6 dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)]">
                    <p className="font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{entry.question}</p>
                    <p className="mt-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><strong>Situation:</strong> {entry.situation}</p>
                    <p className="mt-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><strong>Action:</strong> {entry.action}</p>
                    <p className="mt-1 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"><strong>Result:</strong> {entry.resultPrompt}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </Card>
  );
}
