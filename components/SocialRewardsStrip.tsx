"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "@/app/icons";

// Landing-page strip for the follow-to-rewards event. One fetch on mount;
// every state is server-truth from /api/social-rewards/status: closed hides
// the strip, anonymous sees the offer, a logged-in visitor sees progress, and
// a visitor who claimed all three channels gets the activate CTA right here —
// the trial timer only starts when they press it.
type StatusShape = {
  open: boolean;
  creditsPerPlatform: number;
  dailyMatchesDays: number;
  allClaimed: boolean;
  bonusClaimed: boolean;
  dailyMatchesEnabled: boolean;
  claimed: Record<string, boolean>;
};

export default function SocialRewardsStrip() {
  const [status, setStatus] = useState<StatusShape | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedNow, setActivatedNow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/social-rewards/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => setStatus(null));
  }, []);

  if (!status?.open) return null;

  const allClaimed = status.allClaimed || Object.values(status.claimed).filter(Boolean).length >= 3;
  const bonusLive = status.bonusClaimed || activatedNow;
  const claimedCount = Object.values(status.claimed).filter(Boolean).length;

  async function activate() {
    setActivating(true);
    setError("");
    try {
      const r = await fetch("/api/social-rewards/activate-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Could not activate right now.");
      setActivatedNow(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate right now.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--primary)_7%,var(--background))] dark:bg-[color-mix(in_oklab,var(--primary)_12%,var(--color-dark-bg))]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-center text-sm">
        <Sparkles size={15} className="text-[var(--primary)]" aria-hidden="true" />
        {bonusLive ? (
          <span className="font-semibold text-[var(--fg)] flex items-center gap-1.5">
            <Check size={14} className="text-[var(--success)]" aria-hidden="true" />
            Daily Matches trial active — matched jobs land in your inbox every morning.
          </span>
        ) : allClaimed && status.dailyMatchesEnabled ? (
          <>
            <span className="font-semibold text-[var(--fg)]">
              All channels followed — your {status.dailyMatchesDays}-day Daily Matches trial is ready.
            </span>
            <button
              type="button"
              onClick={() => void activate()}
              disabled={activating}
              className="rounded-full bg-[var(--primary)] px-4 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {activating ? "Activating..." : `Activate ${status.dailyMatchesDays} free days`}
            </button>
          </>
        ) : allClaimed ? (
          <>
            <span className="font-semibold text-[var(--fg)]">
              All channel rewards are claimed. Your {status.dailyMatchesDays}-day Daily Matches trial is ready as soon as matching is available.
            </span>
            <Link href="/social-rewards" className="font-bold text-[var(--primary)] hover:underline">
              View reward <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : (
          <>
            <span className="text-[var(--fg)]">
              <span className="font-semibold">Follow all 3 channels</span> → {status.dailyMatchesDays} days of
              Daily Matches free + {status.creditsPerPlatform} interview credit each
              {claimedCount > 0 ? ` · ${claimedCount}/3 done` : ""}
            </span>
            <Link href="/social-rewards" className="font-bold text-[var(--primary)] hover:underline">
              Claim it <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
        {error && <span className="text-xs font-semibold text-[var(--danger)]" role="alert">{error}</span>}
      </div>
    </div>
  );
}
