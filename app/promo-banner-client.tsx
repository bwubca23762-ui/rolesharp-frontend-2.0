"use client";

import { useEffect, useState } from "react";
import { X } from "./icons";

const KEY = "rs-promo-banner-dismissed";
const RETURN_AFTER_DAYS = 7;

export type PromoBannerData = {
  promoCode: string | null;
  promoLabel: string | null;
  referralReward: number;
  referralCap: number;
  referralWindowDays: number;
};

export default function PromoBannerClient({ data }: { data: PromoBannerData }) {
  // Same CLS logic as StudentBanner: render in the first paint, hide only for
  // recently-dismissed users after hydration.
  const [show, setShow] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY) || 0);
      if (at && Date.now() - at <= RETURN_AFTER_DAYS * 86400e3) setShow(false);
    } catch {}
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  const hasPromo = !!data.promoCode && !!data.promoLabel;
  const referralProof = `${data.referralReward} credit${data.referralReward === 1 ? "" : "s"} per friend · max ${data.referralCap} per ${data.referralWindowDays} days`;

  return (
    <div className="rs-promo-banner" role="region" aria-label="Current offers">
      <div className="rs-promo-banner-inner">
        {hasPromo ? (
          <>
            <a href="/pricing" className="rs-promo-offer" aria-label={`${data.promoLabel} with code ${data.promoCode} — see pricing`}>
              <span className="rs-promo-offer-badge">Limited offer</span>
              <span className="rs-promo-offer-copy">
                <strong>{data.promoLabel}</strong>
                <span className="rs-promo-offer-proof" aria-hidden="true">
                  Code
                  <code>{data.promoCode}</code>
                  at checkout
                </span>
              </span>
              <span className="rs-promo-offer-mobile">
                <strong>{data.promoLabel}</strong> — code {data.promoCode}
              </span>
              <span className="rs-promo-offer-cta">
                <span className="hidden sm:inline">Claim at pricing</span>
                <span className="sm:hidden">Claim</span>
                <span aria-hidden="true">→</span>
              </span>
            </a>
            <a href="/affiliate" className="rs-promo-side-link">
              Refer a friend → free credits
            </a>
          </>
        ) : (
          <a href="/affiliate" className="rs-promo-offer" aria-label="Refer a friend and earn free Premium credits">
            <span className="rs-promo-offer-badge">Referral program</span>
            <span className="rs-promo-offer-copy">
              <strong>Invite a friend, earn free Premium credits.</strong>
              <span className="rs-promo-offer-proof" aria-hidden="true">{referralProof}</span>
            </span>
            <span className="rs-promo-offer-mobile">
              Refer a friend → <strong>free credits</strong>
            </span>
            <span className="rs-promo-offer-cta">
              <span className="hidden sm:inline">Get your invite link</span>
              <span className="sm:hidden">Invite</span>
              <span aria-hidden="true">→</span>
            </span>
          </a>
        )}

        <div className="rs-promo-banner-close">
          <button type="button" aria-label="Dismiss offers banner" onClick={dismiss} className="rs-promo-dismiss">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
