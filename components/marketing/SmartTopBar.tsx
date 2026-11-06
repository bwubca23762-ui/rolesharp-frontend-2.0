"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Sparkles, X, ChevronRight } from "@/app/icons";

const KEY = "rs-smart-topbar-dismissed";
const RETURN_AFTER_DAYS = 7;

type SmartTopBarProps = {
  studentOfferEnabled?: boolean;
  promoCode?: string | null;
  promoLabel?: string | null;
  referralReward?: number;
};

type SocialRewardState = {
  open: boolean;
  allClaimed: boolean;
  bonusClaimed: boolean;
  claimed: Record<string, boolean>;
  dailyMatchesDays?: number;
  creditsPerPlatform?: number;
};

export function SmartTopBar({
  studentOfferEnabled = true,
  promoCode,
  promoLabel,
  referralReward = 5,
}: SmartTopBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const [socialStatus, setSocialStatus] = useState<SocialRewardState | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY) || 0);
      if (at && Date.now() - at <= RETURN_AFTER_DAYS * 86400e3) {
        setDismissed(true);
      }
    } catch {}

    fetch("/api/social-rewards/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSocialStatus(data);
      })
      .catch(() => setSocialStatus(null));
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  const slides = [];
  const socialClaimedCount = Object.values(socialStatus?.claimed ?? {}).filter(Boolean).length;

  // Slide 1: Active Social Rewards Campaign (Highest priority growth event).
  // The numbers come from the live status payload — never hardcoded, the
  // campaign config (days/credits) is owner-tunable in the DB.
  if (socialStatus?.open && !socialStatus.bonusClaimed) {
    const days = socialStatus.dailyMatchesDays ?? 15;
    const credits = socialStatus.creditsPerPlatform ?? 1;
    const completed = socialStatus.allClaimed || socialClaimedCount >= 3;
    slides.push({
      id: "social",
      icon: Sparkles,
      badge: "Limited Event",
      badgeClass: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
      text: (
        <span>
          {completed ? (
            <><strong>Your {days}-day Daily Matches trial is ready.</strong> Activate it when you are ready.</>
          ) : (
            <><strong>Follow all 3 channels</strong> — {days} days of Daily Matches free, {credits} credit{credits === 1 ? "" : "s"} each{socialClaimedCount > 0 ? ` · ${socialClaimedCount}/3 claimed` : ""}.</>
          )}
        </span>
      ),
      ctaText: completed ? "Open reward" : "Claim it",
      href: "/social-rewards",
    });
  }

  // Slide 2: University Student 6-Month Free Offer
  if (studentOfferEnabled) {
    slides.push({
      id: "student",
      icon: GraduationCap,
      badge: "Student Access",
      badgeClass: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300",
      text: (
        <span>
          <strong>Six months of Premium free</strong> for students. No card required.
        </span>
      ),
      ctaText: "Claim student pass",
      href: "/students",
    });
  }

  // Slide 3: Live Promo Code or Referral Credits
  if (promoCode && promoLabel) {
    slides.push({
      id: "promo",
      icon: Sparkles,
      badge: "Special Offer",
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
      text: (
        <span>
          Get <strong>{promoLabel}</strong> with code <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs dark:bg-white/10">{promoCode}</code>
        </span>
      ),
      ctaText: "View pricing",
      href: "/pricing",
    });
  } else if (referralReward) {
    slides.push({
      id: "referral",
      icon: Sparkles,
      badge: "Earn Credits",
      badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
      text: (
        <span>
          Invite a friend, earn <strong>{referralReward} free credit{referralReward > 1 ? "s" : ""}</strong> per friend · max 3 per 30 days.
        </span>
      ),
      ctaText: "Get your invite link",
      href: "/#referral",
    });
  }

  if (slides.length === 0) return null;

  const current = slides[activeSlide % slides.length];
  const Icon = current.icon;

  return (
    <aside
      className="relative z-40 border-b border-[var(--hairline)] bg-[var(--surface-2)] text-xs transition-colors"
      aria-label="Announcements and special offers"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-3 sm:px-6">
        <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden text-center sm:gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${current.badgeClass}`}>
            <Icon size={12} aria-hidden="true" />
            <span>{current.badge}</span>
          </span>

          <span className="truncate text-[var(--fg)]">
            {current.text}
          </span>

          <Link
            href={current.href}
            className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-[var(--primary)] hover:underline"
          >
            <span>{current.ctaText}</span>
            <ChevronRight size={12} aria-hidden="true" />
          </Link>

          {slides.length > 1 && (
            <div className="hidden items-center gap-1 pl-2 md:flex">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeSlide % slides.length
                      ? "w-4 bg-[var(--primary)]"
                      : "w-1.5 bg-[var(--border)] hover:bg-[var(--muted-fg)]"
                  }`}
                  aria-label={`Switch to announcement ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
          aria-label="Dismiss top announcement"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
