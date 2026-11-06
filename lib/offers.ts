import { createHash } from "crypto";
import { canonicalJson } from "./jobs-workflow/canonical-json";
import { q, type TransactionQuery } from "./db";
import { env } from "./env";
import { DEFAULT_STUDENT_MONTHLY_LIMIT } from "./limits";

export const STUDENT_OFFER_KEY = "student_premium" as const;
export type OfferVersionStatus = "draft" | "scheduled" | "published" | "superseded";

export type OfferTermsSnapshot = {
  schemaVersion: 1;
  eligibility: {
    kind: "verified_academic_email";
    lifetimeClaimsPerNormalizedEmail: number;
    lifetimeClaimsPerAccount: number;
  };
  grant: {
    kind: "premium_days";
    days: number;
    premiumSource: "student";
  };
  benefits: {
    tailoredResumesPerMonth: number;
    features: string[];
  };
  verification: {
    tokenTtlHours: number;
  };
};

export type OfferVersionPin = {
  id: string;
  offerKey: string;
  versionNumber: number;
  status: Exclude<OfferVersionStatus, "draft">;
  publicName: string;
  publicSummary: string;
  callToAction: string;
  terms: OfferTermsSnapshot;
  contentDigest: string;
  effectiveAt: string;
  enrollmentEndsAt: string | null;
};

export type PublicOfferSummary = {
  offerKey: string;
  versionNumber: number;
  publicName: string;
  publicSummary: string;
  callToAction: string;
  grantDays: number;
  tailoredResumesPerMonth: number;
  tokenTtlHours: number;
  features: string[];
  effectiveAt: string;
  enrollmentEndsAt: string | null;
};

type OfferVersionRow = {
  id: string;
  offer_key: string;
  version_number: number;
  status: Exclude<OfferVersionStatus, "draft">;
  public_name: string;
  public_summary: string;
  call_to_action: string;
  terms_snapshot: OfferTermsSnapshot;
  content_digest: string;
  effective_at: string;
  enrollment_ends_at: string | null;
};

export const LEGACY_STUDENT_TERMS: OfferTermsSnapshot = {
  schemaVersion: 1,
  eligibility: {
    kind: "verified_academic_email",
    lifetimeClaimsPerNormalizedEmail: 1,
    lifetimeClaimsPerAccount: 1,
  },
  grant: { kind: "premium_days", days: 180, premiumSource: "student" },
  benefits: {
    // Seed terms only. A published offer version in the database wins, and
    // migration 048 makes published versions immutable — so lowering the
    // student allowance in lib/limits.ts does NOT change what an already
    // published offer advertises. That needs a new offer version.
    tailoredResumesPerMonth: DEFAULT_STUDENT_MONTHLY_LIMIT,
    features: [
      "premium_writing_model",
      "cover_letters",
      "interview_prep",
      "docx_export",
      "all_templates",
    ],
  },
  verification: { tokenTtlHours: 24 },
};

const LOCAL_STUDENT_OFFER: OfferVersionPin = {
  id: "00000000-0000-4000-8000-000000000049",
  offerKey: STUDENT_OFFER_KEY,
  versionNumber: 1,
  status: "published",
  publicName: "Student Premium",
  publicSummary: "6 months of RoleSharp Premium, free for verified students.",
  callToAction: "Activate 6 months free",
  terms: LEGACY_STUDENT_TERMS,
  contentDigest: createHash("sha256").update(canonicalJson(LEGACY_STUDENT_TERMS), "utf8").digest("hex"),
  effectiveAt: "1970-01-01T00:00:00.000Z",
  enrollmentEndsAt: null,
};

function assertInteger(value: unknown, name: string, min: number, max: number): asserts value is number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`invalid_offer_${name}`);
  }
}

export function validateOfferTerms(value: unknown): OfferTermsSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_offer_terms");
  const terms = value as Partial<OfferTermsSnapshot>;
  if (terms.schemaVersion !== 1) throw new Error("invalid_offer_schema_version");
  if (terms.eligibility?.kind !== "verified_academic_email") throw new Error("invalid_offer_eligibility");
  assertInteger(terms.eligibility.lifetimeClaimsPerNormalizedEmail, "email_claim_limit", 1, 1);
  assertInteger(terms.eligibility.lifetimeClaimsPerAccount, "account_claim_limit", 1, 1);
  if (terms.grant?.kind !== "premium_days" || terms.grant.premiumSource !== "student") throw new Error("invalid_offer_grant");
  assertInteger(terms.grant.days, "grant_days", 1, 3650);
  assertInteger(terms.benefits?.tailoredResumesPerMonth, "resume_limit", 1, 1000);
  if (!Array.isArray(terms.benefits?.features) || terms.benefits.features.length > 50
      || terms.benefits.features.some((feature) => typeof feature !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(feature))) {
    throw new Error("invalid_offer_features");
  }
  assertInteger(terms.verification?.tokenTtlHours, "token_ttl", 1, 168);
  return terms as OfferTermsSnapshot;
}

function mapPin(row: OfferVersionRow): OfferVersionPin {
  const terms = validateOfferTerms(row.terms_snapshot);
  return {
    id: row.id,
    offerKey: row.offer_key,
    versionNumber: row.version_number,
    status: row.status,
    publicName: row.public_name,
    publicSummary: row.public_summary,
    callToAction: row.call_to_action,
    terms,
    contentDigest: row.content_digest,
    effectiveAt: row.effective_at,
    enrollmentEndsAt: row.enrollment_ends_at,
  };
}

export function publicOfferSummary(pin: OfferVersionPin): PublicOfferSummary {
  return {
    offerKey: pin.offerKey,
    versionNumber: pin.versionNumber,
    publicName: pin.publicName,
    publicSummary: pin.publicSummary,
    callToAction: pin.callToAction,
    grantDays: pin.terms.grant.days,
    tailoredResumesPerMonth: pin.terms.benefits.tailoredResumesPerMonth,
    tokenTtlHours: pin.terms.verification.tokenTtlHours,
    features: [...pin.terms.benefits.features],
    effectiveAt: pin.effectiveAt,
    enrollmentEndsAt: pin.enrollmentEndsAt,
  };
}

export async function effectiveOfferVersion(
  offerKey: string,
  query: TransactionQuery = q,
  at = new Date(),
): Promise<OfferVersionPin | null> {
  if (env.localDevMode && query === q && offerKey === STUDENT_OFFER_KEY) return LOCAL_STUDENT_OFFER;
  const row = (await query<OfferVersionRow>(
    `select id,offer_key,version_number,status,public_name,public_summary,call_to_action,
       terms_snapshot,content_digest,effective_at,enrollment_ends_at
     from offer_versions
     where offer_key=$1
       and status in ('scheduled','published')
       and effective_at<=$2
       and (enrollment_ends_at is null or enrollment_ends_at>$2)
     order by effective_at desc,version_number desc
     limit 1`,
    [offerKey, at.toISOString()],
  ))[0];
  return row ? mapPin(row) : null;
}

export async function requireEffectiveOfferVersion(
  offerKey: string,
  query: TransactionQuery = q,
  at = new Date(),
): Promise<OfferVersionPin> {
  const version = await effectiveOfferVersion(offerKey, query, at);
  if (!version) throw new Error("offer_unavailable");
  return version;
}

export async function pinnedOfferVersion(
  versionId: string,
  query: TransactionQuery = q,
): Promise<OfferVersionPin | null> {
  if (env.localDevMode && query === q && versionId === LOCAL_STUDENT_OFFER.id) return LOCAL_STUDENT_OFFER;
  const row = (await query<OfferVersionRow>(
    `select id,offer_key,version_number,status,public_name,public_summary,call_to_action,
       terms_snapshot,content_digest,effective_at,enrollment_ends_at
     from offer_versions where id=$1 and status in ('scheduled','published','superseded') limit 1`,
    [versionId],
  ))[0];
  return row ? mapPin(row) : null;
}

export async function currentStudentOffer(query: TransactionQuery = q): Promise<OfferVersionPin> {
  return requireEffectiveOfferVersion(STUDENT_OFFER_KEY, query);
}

export async function currentStudentOfferSummary(query: TransactionQuery = q): Promise<PublicOfferSummary> {
  return publicOfferSummary(await currentStudentOffer(query));
}

export function offerSnapshotParams(pin: OfferVersionPin) {
  return [pin.id, pin.offerKey, pin.versionNumber, pin.contentDigest, pin.terms] as const;
}
