"use client";
import { useState } from "react";
import { Badge, Button, Input } from "@/components/ui/primitives";
import {
  DEFAULT_DAYS_MONTHLY,
  DEFAULT_REFERRAL_CREDIT_REWARD,
  DEFAULT_REFERRAL_MONTHLY_CAP,
} from "@/lib/limits";
import { Sparkles } from "../../icons";
import FeatureSection from "../feature-section";

export default function CreditsPanel({ me }: any) {
  const [msg, setMsg] = useState<any>(null);
  const inviteUrl = me?.inviteUrl || "";

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      setMsg({ ok: 1, t: "Invite link copied." });
    } catch {
      setMsg({ t: "Could not copy the link. Select it above and copy it manually." });
    }
  }

  return (
    <FeatureSection icon={<Sparkles size={20} />} title="Credits" description="Earned by invites, spent on premium generations.">
      <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
        <Badge variant="premium">{me?.credits ?? 0} credits</Badge>
        <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] ml-2">
          — one credit unlocks one premium resume generation when your free monthly resumes are used.
        </span>
      </p>
      <div>
        <h4 className="text-base font-semibold! text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">
          Invite friends
        </h4>
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] mb-3">
          Credits are earned, not sold — inviting friends is the way to get them. You get{" "}
          {DEFAULT_REFERRAL_CREDIT_REWARD} premium credit for each friend who builds their first
          resume. Max {DEFAULT_REFERRAL_MONTHLY_CAP} credits per {DEFAULT_DAYS_MONTHLY} days.
        </p>
        <Input
          readOnly
          value={inviteUrl || "Loading invite link..."}
          aria-label="Your invite link"
          className="mb-3"
        />
        <Button variant="outline" size="sm" onClick={copyInvite} disabled={!inviteUrl}>
          Copy invite link
        </Button>
      </div>
      <p className="mt-5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        Need more generations than credits can cover? A{" "}
        <a href="/settings?tab=billing" className="font-semibold text-[var(--color-primary)] hover:underline">
          Premium pass
        </a>{" "}
        raises your monthly allowance directly — that is the paid path; credits are only the referral
        reward.
      </p>
      {msg && (
        <p
          className={`mt-4 text-sm font-semibold ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.t}
        </p>
      )}
    </FeatureSection>
  );
}
