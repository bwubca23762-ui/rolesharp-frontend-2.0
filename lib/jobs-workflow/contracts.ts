import { z } from "zod";

const limitedText = z.string().trim().min(1).max(200);
const uniqueTextArray = (max: number, min = 0) => z.array(limitedText).min(min).max(max)
  .refine((values) => new Set(values.map((value) => value.toLocaleLowerCase("en"))).size === values.length,
    "values must be unique");

export const CountryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/u);
export const CurrencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/u);
export const IanaTimezone = z.string().trim().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "invalid IANA timezone");
export const DailyTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);
export const Seniority = z.enum(["intern", "entry", "mid", "senior", "staff_or_lead", "principal"]);
export const CareerTrack = z.enum(["individual", "management"]);
export const RemotePolicy = z.enum(["remote", "hybrid", "onsite"]);
export const WorkType = z.enum(["full_time", "part_time", "contract", "internship", "temporary"]);

export const CareerProfileInput = z.object({
  desiredTitles: uniqueTextArray(20, 1),
  skills: z.array(z.object({
    name: limitedText.max(120),
    state: z.enum(["possessed", "not_possessed"]),
  }).strict()).max(256),
  relevantExperienceMonths: z.number().int().min(0).max(1200).optional(),
  seniority: z.object({ level: Seniority, track: CareerTrack }).strict().optional(),
  acceptedTracks: z.array(CareerTrack).max(2).default(["individual"]),
  locations: uniqueTextArray(50).default([]),
  remotePolicies: z.array(RemotePolicy).max(3)
    .refine((values) => new Set(values).size === values.length).default([]),
  authorization: z.enum(["authorized", "needs_sponsorship", "unknown"]).default("unknown"),
  workTypes: z.array(WorkType).max(5)
    .refine((values) => new Set(values).size === values.length).default([]),
  compensationFloor: z.object({
    amountMinor: z.number().int().min(0).max(1_000_000_000_000),
    currency: CurrencyCode,
    period: z.enum(["hourly", "daily", "weekly", "monthly", "annual"]),
  }).strict().optional(),
}).strict();

export const CampaignCriteria = z.object({
  desiredTitles: uniqueTextArray(20, 1),
  mustHaveSkills: uniqueTextArray(100).default([]),
  preferredSkills: uniqueTextArray(100).default([]),
  countries: z.array(CountryCode).max(50)
    .refine((values) => new Set(values).size === values.length).default([]),
  locations: uniqueTextArray(50).default([]),
  remotePolicies: z.array(RemotePolicy).max(3)
    .refine((values) => new Set(values).size === values.length).default([]),
  workTypes: z.array(WorkType).max(5)
    .refine((values) => new Set(values).size === values.length).default([]),
  authorization: z.enum(["authorized", "needs_sponsorship", "either", "unknown"]).default("unknown"),
  compensationFloor: z.object({
    amountMinor: z.number().int().min(0).max(1_000_000_000_000),
    currency: CurrencyCode,
    period: z.enum(["hourly", "daily", "weekly", "monthly", "annual"]),
  }).strict().optional(),
  excludedCompanies: uniqueTextArray(100).default([]),
  blockedSources: uniqueTextArray(50).default([]),
}).strict();

const CampaignCommon = z.object({
  profileVersionId: z.string().uuid(),
  criteria: CampaignCriteria,
  timezone: IanaTimezone,
  dailyTime: DailyTime,
  fitScoreFloor: z.number().int().min(0).max(100),
  confidenceScoreFloor: z.number().int().min(0).max(100),
  status: z.enum(["draft", "active"]).default("draft"),
});

export const CampaignCreateInput = z.discriminatedUnion("mode", [
  CampaignCommon.extend({
    mode: z.literal("daily_matches"),
    dailyLimit: z.number().int().min(1).max(10),
    authorizationMode: z.literal("review_each").default("review_each"),
  }).strict(),
  CampaignCommon.extend({
    mode: z.literal("role_apply"),
    dailyLimit: z.number().int().min(1).max(5),
    authorizationMode: z.literal("review_each"),
    pinnedConnectionId: z.string().uuid().optional(),
    consentConfirmed: z.boolean().default(false),
  }).strict(),
]);

export const CampaignUpdateInput = z.object({
  profileVersionId: z.string().uuid().optional(),
  criteria: CampaignCriteria.optional(),
  timezone: IanaTimezone.optional(),
  dailyTime: DailyTime.optional(),
  dailyLimit: z.number().int().min(1).max(10).optional(),
  fitScoreFloor: z.number().int().min(0).max(100).optional(),
  confidenceScoreFloor: z.number().int().min(0).max(100).optional(),
  pinnedConnectionId: z.string().uuid().nullable().optional(),
  action: z.enum(["pause", "resume", "cancel"]).optional(),
  consentConfirmed: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "at least one update is required");

export const ApplicationSendPolicyInput = z.object({
  timezone: IanaTimezone,
  userLimit: z.number().int().min(1).max(5),
}).strict();

export const CursorQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type CareerProfileInput = z.infer<typeof CareerProfileInput>;
export type CampaignCreateInput = z.infer<typeof CampaignCreateInput>;
export type CampaignUpdateInput = z.infer<typeof CampaignUpdateInput>;
export type CampaignCriteria = z.infer<typeof CampaignCriteria>;
export type ApplicationSendPolicyInput = z.infer<typeof ApplicationSendPolicyInput>;
