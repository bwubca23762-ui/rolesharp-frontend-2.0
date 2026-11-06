import { z } from "zod";

export const SCORE_VERSION = "job-match-v1" as const;
export const NORMALIZATION_VERSION = "job-match-normalization-v1" as const;
export const FX_VERSION = "fx-v1" as const;

export const SIGNAL_ORDER = [
  "required_skills",
  "title",
  "experience",
  "seniority",
  "preferred_skills",
  "location_remote",
  "authorization",
  "work_type",
  "compensation",
  "freshness",
] as const;
export type Signal = (typeof SIGNAL_ORDER)[number];

const text = z.string().trim().min(1).max(500);
const sourceId = z.string().regex(/^[A-Za-z0-9:_-]+$/).max(120);
const currency = z.string().regex(/^[A-Z]{3}$/);
const period = z.enum(["hourly", "daily", "weekly", "monthly", "annual"]);
const seniority = z.enum(["intern", "entry", "mid", "senior", "staff_or_lead", "principal"]);
const track = z.enum(["individual", "management"]);
const remotePolicy = z.enum(["remote", "hybrid", "onsite"]);
const workType = z.enum(["full_time", "part_time", "contract", "internship", "temporary"]);
const boundedMinor = z.number().int().nonnegative().max(1_000_000_000_000);

const ProfileSchema = z.object({
  desiredTitles: z.array(z.object({
    text: text.max(200),
    evidence: z.enum(["explicit", "inferred"]),
  }).strict()).max(20),
  skills: z.array(z.object({
    text,
    state: z.enum(["possessed", "not_possessed", "unknown"]),
    evidence: z.enum(["authoritative_current", "explicit_current", "resume_positive", "unknown"]),
    sourceId,
  }).strict()).max(256),
  relevantExperience: z.object({
    months: z.number().int().nonnegative().max(1200),
    evidence: z.enum(["verified_dated", "inferred"]),
  }).strict().optional(),
  seniority: z.object({
    level: seniority,
    track,
    evidence: z.enum(["explicit", "inferred"]),
  }).strict().optional(),
  acceptedTracks: z.array(track).max(2),
  locationPreferences: z.array(z.object({
    location: text.max(120),
    priority: z.enum(["desired", "acceptable"]),
  }).strict()).max(50),
  remotePolicies: z.array(remotePolicy).max(3),
  preferenceEvidence: z.enum(["confirmed", "inferred", "unknown"]),
  authorization: z.object({
    state: z.enum(["authorized", "needs_sponsorship", "unknown"]),
    evidence: z.enum(["confirmed", "inferred", "unknown"]),
  }).strict(),
  workTypes: z.array(z.object({
    type: workType,
    priority: z.enum(["desired", "acceptable"]),
  }).strict()).max(5),
  compensationFloor: z.object({
    amountMinor: boundedMinor,
    currency,
    period,
  }).strict().optional(),
}).strict();

const JobSchema = z.object({
  canonicalJobKey: z.string().trim().min(1).max(300),
  title: z.object({
    text: text.max(200),
    evidence: z.enum(["structured", "inferred", "unknown"]),
  }).strict().optional(),
  skillRequirements: z.array(z.object({
    text,
    kind: z.enum(["required", "preferred", "negated"]),
    mandatory: z.boolean(),
    evidence: z.enum(["labeled_list", "explicit_prose", "heuristic", "absent"]),
    sourceId,
  }).strict()).max(256),
  experience: z.object({
    minimumMonths: z.number().int().nonnegative().max(1200),
    nonNegotiable: z.boolean(),
    evidence: z.enum(["explicit", "inferred"]),
  }).strict().optional(),
  seniority: z.object({
    level: seniority,
    track,
    evidence: z.enum(["explicit", "inferred"]),
    forbiddenLevels: z.array(seniority).max(6),
  }).strict().optional(),
  location: z.object({
    locations: z.array(text.max(120)).max(50),
    remotePolicy,
    evidence: z.enum(["explicit", "inferred", "unknown"]),
  }).strict().optional(),
  authorization: z.object({
    sponsorship: z.enum(["not_required", "available", "unavailable", "silent"]),
    evidence: z.enum(["explicit", "inferred", "silent"]),
  }).strict().optional(),
  workType: z.object({
    type: workType,
    evidence: z.enum(["explicit", "inferred", "unknown"]),
  }).strict().optional(),
  compensation: z.object({
    lowerMinor: boundedMinor.optional(),
    upperMinor: boundedMinor.optional(),
    currency,
    period,
    evidence: z.enum(["explicit", "inferred"]),
  }).strict().optional(),
  freshness: z.object({
    publishedAt: z.string().datetime(),
    capturedAt: z.string().datetime(),
    evidence: z.enum(["provider", "metadata"]),
  }).strict().optional(),
  gates: z.object({
    listingStatus: z.enum(["active", "expired"]),
    duplicate: z.boolean(),
    sourceBlocked: z.boolean(),
    companyBlocked: z.boolean(),
    previouslyApplied: z.boolean(),
    employerIdentity: z.enum(["verified", "ambiguous"]),
  }).strict(),
  automation: z.object({
    emailInstruction: z.enum(["explicit", "missing"]),
    recipient: z.enum(["source_backed", "unverified", "missing"]),
    consent: z.enum(["current", "expired", "missing"]),
    package: z.enum(["valid", "invalid", "missing"]),
    answers: z.enum(["safe", "uncertain", "sensitive"]),
  }).strict(),
}).strict();

export const MatchInputSchema = z.object({
  scoreVersion: z.literal(SCORE_VERSION),
  normalizationVersion: z.literal(NORMALIZATION_VERSION),
  profile: ProfileSchema,
  job: JobSchema,
  fxSnapshot: z.object({
    version: z.literal(FX_VERSION),
    rates: z.array(z.object({
      currency,
      numerator: z.number().int().positive().max(1_000_000_000),
      denominator: z.number().int().positive().max(1_000_000_000),
    }).strict()).max(100),
  }).strict(),
}).strict();

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;
export type MatchInput = DeepReadonly<z.infer<typeof MatchInputSchema>>;
export type HardBlockerKind =
  | "expired_listing" | "duplicate_listing" | "blocked_source" | "blocked_company"
  | "prior_application" | "missing_mandatory_skill" | "below_non_negotiable_experience"
  | "forbidden_seniority" | "incompatible_location" | "incompatible_authorization"
  | "incompatible_work_type" | "compensation_conflict";
export type HardBlocker = {
  readonly kind: HardBlockerKind;
  readonly provenance: readonly string[];
  readonly canonicalSkillId?: string;
};
export type AutomationBlocker =
  | "ambiguous_employer_identity" | "missing_email_instruction" | "unverified_recipient"
  | "inactive_consent" | "invalid_package" | "unsafe_answers" | "score_floor";
export type SignalScore = {
  readonly signal: Signal;
  readonly weightBasisPoints: number;
  readonly matchBasisPoints: number;
  readonly reliabilityBasisPoints: number;
  readonly fitNumerator: number;
  readonly confidenceNumerator: number;
  readonly fitDisplayPoints: number;
  readonly confidenceDisplayPoints: number;
  readonly explanation: string;
  readonly provenance: readonly string[];
};
export type ScoredMatch = {
  readonly kind: "scored";
  readonly scoreVersion: typeof SCORE_VERSION;
  readonly normalizationVersion: typeof NORMALIZATION_VERSION;
  readonly canonicalJobKey: string;
  readonly publishedAtEpochMs: number;
  readonly matchScore: number;
  readonly confidenceScore: number;
  readonly fitNumerator: number;
  readonly confidenceNumerator: number;
  readonly signals: readonly SignalScore[];
  readonly blockers: readonly HardBlocker[];
  readonly automationBlockers: readonly AutomationBlocker[];
  readonly eligibility: {
    readonly dailyDigest: boolean;
    readonly reviewQueue: boolean;
    readonly automaticEmail: boolean;
  };
  readonly negatedSkillIds: readonly string[];
};
export type InvalidMatchInput = {
  readonly kind: "invalid_input";
  readonly issues: readonly { readonly path: string; readonly code: string }[];
};
export type MatchOutcome = ScoredMatch | InvalidMatchInput;
