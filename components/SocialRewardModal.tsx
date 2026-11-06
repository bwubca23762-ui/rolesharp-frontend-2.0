"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Coins, Shield, Sparkles } from "@/app/icons";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useSession } from "@/app/session-context";
import { errorMessage } from "@/lib/error-message";

// The follow-to-earn claim surface: one card per channel. Each claim pays
// credits (admin-settable) and requires a logged-in, email-verified account;
// the same handle can only ever claim once across the platform, and an
// account claims each platform once.
type Platform = "x" | "linkedin" | "instagram";

const CHANNELS: Array<{ platform: Platform; label: string; url: string; handleLabel: string }> = [
  { platform: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/rolesharpai", handleLabel: "Your LinkedIn profile handle" },
  { platform: "x", label: "X (Twitter)", url: "https://x.com/rolesharpai", handleLabel: "Your X handle, e.g. @johndoe" },
  { platform: "instagram", label: "Instagram", url: "https://instagram.com/rolesharp", handleLabel: "Your Instagram handle" },
];

type RewardStatusShape = {
  open: boolean;
  creditsPerPlatform: number;
  dailyMatchesDays: number;
  dailyMatchesEnabled: boolean;
  allClaimed: boolean;
  bonusClaimed: boolean;
  claimed: Record<string, boolean>;
  reviewRequired?: boolean;
  pending?: Record<string, boolean>;
  rejected?: Record<string, string>;
};

export default function SocialRewardModal({ compact = false }: { compact?: boolean }) {
  const { session: me, refreshSession } = useSession();
  const [status, setStatus] = useState<RewardStatusShape | null>(null);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Platform | null>(null);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [bonusError, setBonusError] = useState("");
  const [claimedNow, setClaimedNow] = useState<Record<string, boolean>>({});
  const [pendingNow, setPendingNow] = useState<Record<string, boolean>>({});
  const [dailyMatchesDaysNow, setDailyMatchesDaysNow] = useState(0);
  const [err, setErr] = useState<Record<string, string>>({});

  const refreshClaims = useCallback(async () => {
    try {
      const response = await fetch("/api/social-rewards/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Reward status is unavailable. Please try again.");
      setStatus(await response.json()); setPendingNow({}); setClaimedNow({});
      setErr((current) => ({ ...current, status: "" }));
    } catch { setErr((current) => ({ ...current, status: "Reward status is unavailable. Please try again." })); }
  }, []);
  useEffect(() => { void refreshClaims(); }, [refreshClaims]);

  const bonusDays = status?.dailyMatchesDays ?? 0;

  if (status && !status.open && !me?.loggedIn) return null;
  if (!me?.loggedIn) {
    return (
      <Card className={compact ? "p-4" : "p-6"}>
        <p className="text-sm font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          Follow RoleSharp, earn free interview credits and Daily Matches.
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          {bonusDays > 0 && status?.dailyMatchesEnabled
            ? `Claim all three channel rewards, then activate your ${bonusDays}-day Daily Matches trial when the matching feature is enabled. The timer starts on activation.`
            : bonusDays > 0
            ? `Channel credits are available now. The ${bonusDays}-day Daily Matches trial can be activated after the matching feature is enabled.`
            : "Log in first — the follow reward lands in your account, not on a coupon."}
        </p>
        <Button as="a" href="/login?next=/social-rewards" size="sm" variant="outline" className="mt-3">
          Continue to login
        </Button>
      </Card>
    );
  }

  const anyClaimable = status?.open ? CHANNELS.some((c) => !status.claimed[c.platform] && !claimedNow[c.platform] && !status.pending?.[c.platform] && !pendingNow[c.platform] && !status.rejected?.[c.platform]) : false;
  const allClaimed = status ? (status.allClaimed || CHANNELS.every((c) => status.claimed[c.platform] || claimedNow[c.platform])) : false;
  const bonusDone = allClaimed && (status?.bonusClaimed || dailyMatchesDaysNow > 0);
  const claimedCount = status ? CHANNELS.filter((c) => status.claimed[c.platform] || claimedNow[c.platform]).length : 0;
  const progress = Math.round((claimedCount / CHANNELS.length) * 100);

  return (
    <Card className={`overflow-hidden ${compact ? "p-4" : "p-0"}`} variant="elevated" aria-label="RoleSharp social rewards">
      {!compact && (
        <div className="relative overflow-hidden border-b border-white/15 bg-[linear-gradient(135deg,#061A38_0%,#0B4D97_62%,#0A84FF_100%)] px-5 py-6 text-white md:px-7 md:py-7">
          <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-sky-300/20 blur-2xl" />
          <div aria-hidden="true" className="absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-indigo-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white">Community reward</Badge>
              <h3 className="mt-3 text-2xl font-extrabold! tracking-[-0.03em]!">Turn three follows into useful career momentum.</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Earn interview credits for approved channel claims, then choose when your Daily Matches trial begins.</p>
            </div>
            <div className="min-w-40 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100">Your progress</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{claimedCount}<span className="text-base font-semibold text-blue-100"> / {CHANNELS.length}</span></p>
            </div>
          </div>
        </div>
      )}
      <div className={compact ? "" : "p-5 md:p-7"}>
        {compact && <h3 className="text-lg font-bold! text-[var(--fg)]">Community rewards</h3>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-6 text-[var(--muted-fg)]">{status?.reviewRequired ? "Follow, attest, and submit for staff review. Credits arrive after approval." : "Follow, attest, and claim."} Each handle can be rewarded once; follows are self-attested.</p>
          {status && <Badge variant="primary"><Coins size={13} /> {status.creditsPerPlatform} credit{status.creditsPerPlatform === 1 ? "" : "s"} per channel</Badge>}
        </div>
        <Button className="mt-3" size="sm" variant="outline" disabled={busy !== null || bonusBusy} onClick={() => void refreshClaims()}>Refresh claim status</Button>
        {err.status && <p className="mt-2 text-sm text-[var(--color-danger)]" role="alert">{err.status}</p>}
        {status && !status.open && <p className="mt-3 text-sm" role="status">The campaign is closed to new claims. Your submitted claims are shown below.</p>}
        <div className="mt-4" aria-label={`${claimedCount} of ${CHANNELS.length} channels claimed`}>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted-fg)]"><span>Reward path</span><span>{claimedCount}/{CHANNELS.length} claimed</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)] dark:bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#0A84FF,#5AC8FA)] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
        </div>
      {bonusDays > 0 && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-[#0071E3]/15 bg-[#0071E3]/[0.05] p-4 text-sm leading-6 dark:bg-[#0A84FF]/[0.10]">
          <Shield size={18} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <p>
          <span className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            Follow and attest to all {CHANNELS.length} channels → {bonusDays} free days of Daily Matches.
          </span>{" "}
          <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            {status?.dailyMatchesEnabled
              ? `Activate the one-time trial after all channels are claimed. Get up to five matches a day for ${bonusDays} days; set up your profile and campaign in settings. No card.`
              : `The matching feature is not enabled yet. Approved claims earn channel credits; you can activate the ${bonusDays}-day trial once it is enabled. No card.`}
          </span>
          </p>
        </div>
      )}
      {bonusDays > 0 && !bonusDone && claimedCount > 0 && anyClaimable && (
        <p className="mt-2 text-sm font-semibold text-[var(--color-primary)]">
          {claimedCount} of {CHANNELS.length} channel rewards claimed — {CHANNELS.length - claimedCount} more for the {bonusDays}-day trial.
        </p>
      )}

      {allClaimed && status ? (
        bonusDone ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]" role="status">
            <Check size={15} aria-hidden="true" /> Every channel claimed — your Daily Matches trial has been activated.
            <Button as="a" href="/campaign-settings" size="sm" variant="outline" className="ml-2">Set up Daily Matches</Button>
          </p>
        ) : allClaimed && bonusDays > 0 ? (
          <div className="mt-4" role="status">
            <p className="text-sm font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              All channel credits are claimed. {status.dailyMatchesEnabled
                ? `Activate your ${bonusDays}-day Daily Matches trial when you are ready; the timer starts then.`
                : `The Daily Matches feature is not enabled yet. Your ${bonusDays}-day trial has not started.`}
            </p>
            {status.dailyMatchesEnabled && status.open && (
              <Button className="mt-2" size="sm" disabled={bonusBusy} isLoading={bonusBusy} onClick={() => void activateBonus()}>
                Activate {bonusDays}-day Daily Matches trial
              </Button>
            )}
            {bonusError && <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]" role="alert">{bonusError}</p>}
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]" role="status">
            <Check size={15} aria-hidden="true" /> You have claimed every channel credit. Spend them on interview practice.
          </p>
        )
      ) : (
        <div className="mt-5 grid gap-3">
          {CHANNELS.map((channel) => {
            const done = status?.claimed[channel.platform] || claimedNow[channel.platform];
            const pending = status?.pending?.[channel.platform] || pendingNow[channel.platform];
            const rejected = status?.rejected?.[channel.platform];
            return (
              <div key={channel.platform} className={`rounded-2xl border p-4 transition-colors ${done ? "border-emerald-500/25 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]" : "border-[var(--color-border)] bg-[var(--color-surface-2)]/45 hover:border-[#0071E3]/35 dark:border-[var(--color-dark-border)] dark:bg-white/[0.03]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={channel.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
                    <Sparkles size={15} aria-hidden="true" /> {channel.label} <span className="font-medium text-[var(--muted-fg)]">· Follow us ↗</span>
                  </a>
                  {done && <Badge variant="success"><Check size={13} /> Claimed</Badge>}
                  {pending && !done && <Badge variant="warning">Awaiting review</Badge>}
                  {rejected && !done && <Badge variant="neutral">Not approved</Badge>}
                </div>
                {rejected && <p className="mt-2 text-sm">{rejected} <a className="underline" href="/support">Contact support</a></p>}
                {!done && !pending && !rejected && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`sr-handle-${channel.platform}`}>{channel.handleLabel}</label>
                    <input
                      id={`sr-handle-${channel.platform}`}
                      value={handles[channel.platform] ?? ""}
                      onChange={(e) => { setHandles((c) => ({ ...c, [channel.platform]: e.target.value })); setErr((c) => ({ ...c, [channel.platform]: "" })); }}
                      placeholder={channel.handleLabel}
                      maxLength={60}
                      className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
                    />
                    <label className="flex min-h-10 w-full items-center gap-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      <input
                        type="checkbox"
                        checked={followed[channel.platform] ?? false}
                        onChange={(event) => setFollowed((current) => ({ ...current, [channel.platform]: event.target.checked }))}
                      />
                      I followed this channel. I understand this is self-attested.
                    </label>
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={!status?.open || busy !== null || !(handles[channel.platform] ?? "").trim() || !followed[channel.platform]}
                      isLoading={busy === channel.platform}
                      onClick={() => void claim(channel.platform)}
                    >
                      {status?.reviewRequired ? "Submit for review" : "Claim"}
                    </Button>
                  </div>
                )}
                {err[channel.platform] && <p className="mt-1.5 text-xs font-semibold text-[var(--color-danger)]" role="alert">{err[channel.platform]}</p>}
              </div>
            );
          })}
        </div>
      )}

      {!status && <p className="mt-3 text-xs text-[var(--color-text-muted)]" aria-busy="true">Loading the event…</p>}

      <p className="mt-5 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--muted-fg)] dark:border-[var(--color-dark-border)]">
        One reward per channel per account; each handle can only claim once. Rewards require a verified email and an explicit follow attestation.
      </p>
      </div>
    </Card>
  );

  async function claim(platform: Platform) {
    const handle = handles[platform];
    setBusy(platform);
    try {
      const r = await fetch("/api/social-rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle, followed: followed[platform] === true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) { window.location.href = "/login?next=/social-rewards"; return; }
        throw new Error(errorMessage(j?.error, "Could not claim right now."));
      }
      if (j.reviewStatus === "pending") setPendingNow((current) => ({ ...current, [platform]: true }));
      else setClaimedNow((c) => ({ ...c, [platform]: true }));
      void refreshSession();
    } catch (e: any) {
      setErr((c) => ({ ...c, [platform]: e?.message || "Could not claim right now." }));
    } finally {
      setBusy(null);
    }
  }

  async function activateBonus() {
    setBonusBusy(true);
    setBonusError("");
    try {
      const response = await fetch("/api/social-rewards/activate-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(data?.error, "Could not activate the Daily Matches trial."));
      setDailyMatchesDaysNow(Number(data.dailyMatchesDaysGranted ?? 0));
      setStatus((current) => current ? { ...current, bonusClaimed: true } : current);
    } catch (error) {
      setBonusError(errorMessage(error, "Could not activate the Daily Matches trial."));
    } finally {
      setBonusBusy(false);
    }
  }
}
