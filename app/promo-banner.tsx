import { featuredPromo } from "@/lib/featured-promo";
import { env } from "@/lib/env";
import PromoBannerClient from "./promo-banner-client";

// Landing offer rail above the student banner. The promo half is live-data
// driven (lib/featured-promo reads the promo_codes table), so this banner can
// never advertise a code that isn't currently redeemable. When no code is
// active, the rail falls back to the always-on referral program.
export default async function PromoBanner() {
  const promo = await featuredPromo();
  const promoLabel = promo
    ? promo.percentageOff != null
      ? `${promo.percentageOff}% off Premium`
      : promo.amountOffCents != null
        ? `$${(promo.amountOffCents / 100).toFixed(promo.amountOffCents % 100 === 0 ? 0 : 2)} off Premium`
        : null
    : null;

  return (
    <PromoBannerClient
      data={{
        promoCode: promo && promoLabel ? promo.code : null,
        promoLabel,
        referralReward: env.referralCreditReward,
        referralCap: env.referralMonthlyCap,
        referralWindowDays: env.daysMonthly,
      }}
    />
  );
}
