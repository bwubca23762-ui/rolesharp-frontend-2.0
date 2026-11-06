import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getEntitlement, featuresFor, PLANS } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { q } from "@/lib/db";
import { ensureInviteCode } from "@/lib/credits";
import { getDevUserById } from "@/lib/local-dev-store";
import { currentRequiredLegalVersions, pendingLegalAcceptances } from "@/lib/legal";

export const runtime = "nodejs";

// Per-user response: never edge-cacheable. The config-level /api rule already
// sends private,no-store; this header is defense-in-depth on the single most
// sensitive shared-URL response in the app (a cached logged-in /api/me would
// hand one user's session state to whoever requests the URL next).
const NO_STORE = { "Cache-Control": "private, no-store" };

// Current user + tier status + plan pricing. Drives the whole UI.
export async function GET() {
  const user = await currentUser();
  const plans = Object.values(PLANS).map((p) => ({ id: p.id, label: p.label, price: p.cents / 100, days: p.days }));
  if (!user) {
    const legalVersions = await currentRequiredLegalVersions().catch(() => []);
    return NextResponse.json({ loggedIn: false, plans, features: featuresFor(null, false), googleEnabled: env.googleEnabled, legalVersions }, { headers: NO_STORE });
  }
  // Everything below needs `user` and nothing else — none of these reads
  // depends on another's result, so they were serial only by how they were
  // written. This is the hottest authenticated path in the app: it runs on
  // every page load, again on every five-minute refresh, and again on every tab
  // visibility change, so the round trips it does not need are paid constantly.
  //
  // Note that `{ a: await x(), b: await y() }` is also serial — object
  // properties are evaluated in order — which is why the two legal reads that
  // look parallel at the bottom of this handler were not.
  if (env.localDevMode) {
    const [ent, inviteCode, account, legalVersions] = await Promise.all([
      getEntitlement(user),
      ensureInviteCode(user.id).catch(() => ""),
      getDevUserById(user.id),
      currentRequiredLegalVersions(),
    ]);
    return NextResponse.json({
      loggedIn: true,
      userId: user.id,
      email: user.email,
      emailVerified: !!account?.emailVerifiedAt,
      inviteCode,
      inviteUrl: inviteCode ? `${env.siteUrl}/login?invite=${encodeURIComponent(inviteCode)}` : "",
      hasPassword: true,
      premium: ent.premium,
      premiumSource: user.premiumSource ?? null,
      premiumUntil: ent.premiumUntil,
      features: ent.features,
      limit: ent.limit,
      used: ent.used,
      remaining: ent.remaining,
      credits: ent.credits,
      canUseCredit: ent.canUseCredit,
      period: ent.period,
      canGenerate: ent.canGenerate,
      plans,
      googleEnabled: false,
      legalVersions,
      pendingLegalAcceptances: [],
    }, { headers: NO_STORE });
  }
  const [ent, inviteCode, accountRows, legalVersions, pending] = await Promise.all([
    getEntitlement(user),
    ensureInviteCode(user.id).catch(() => ""),
    q<{ has_password: boolean; email_verified_at: string | null }>("select password_hash is not null as has_password, email_verified_at from users where id=$1", [user.id]),
    currentRequiredLegalVersions(),
    pendingLegalAcceptances(user.id),
  ]);
  const account = accountRows[0];
  const safe: Omit<typeof ent, "model"> = {
    premium: ent.premium,
    premiumUntil: ent.premiumUntil,
    features: ent.features,
    limit: ent.limit,
    used: ent.used,
    remaining: ent.remaining,
    credits: ent.credits,
    canUseCredit: ent.canUseCredit,
    period: ent.period,
    canGenerate: ent.canGenerate,
  };
  return NextResponse.json({
    loggedIn: true,
    userId: user.id,
    email: user.email,
    emailVerified: !!account?.email_verified_at,
    inviteCode,
    inviteUrl: inviteCode ? `${env.siteUrl}/login?invite=${encodeURIComponent(inviteCode)}` : "",
    hasPassword: account?.has_password ?? true,
    // Drives the plan label. Without it a student account reads "Premium"
    // everywhere, which is the badge for the tier they did not buy and whose
    // allowance they do not have.
    premiumSource: user.premiumSource ?? null,
    ...safe,
    plans,
    legalVersions,
    pendingLegalAcceptances: pending,
  }, { headers: NO_STORE });
}
