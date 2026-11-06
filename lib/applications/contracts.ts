import { z } from "zod";

export const APPLICATION_STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);

const httpUrl = z.string().trim().max(500).url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "job_url_must_use_http_or_https");

const provider = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/i);
const providerJobId = z.string().trim().min(1).max(200);

// Resume variant label (Phase 4 A/B analytics): which resume version the
// candidate actually sent. Free-text, short — users compare their own
// labels; the product never invents or auto-assigns a winner.
export const ResumeVariantLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .nullable()
  .optional();

export const ApplicationCreateSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  status: ApplicationStatusSchema.optional().default("saved"),
  jobUrl: httpUrl.optional(),
  notes: z.string().trim().max(2_000).optional(),
  resumeId: z.string().uuid().nullable().optional(),
  resumeVariantLabel: ResumeVariantLabelSchema,
  jobId: z.string().uuid().nullable().optional(),
  provider: provider.optional(),
  providerJobId: providerJobId.optional(),
  // Compensation (gap report Tier B): optional on create; whole currency
  // units. Offered base lands when the offer does — it feeds outcome
  // analysis (offers by fit score) only because users record it here.
  targetSalaryMin: z.number().int().min(0).max(100_000_000).nullable().optional(),
  targetSalaryMax: z.number().int().min(0).max(100_000_000).nullable().optional(),
  offeredBase: z.number().int().min(0).max(100_000_000).nullable().optional(),
  compCurrency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  equityNote: z.string().trim().max(300).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.provider) !== Boolean(value.providerJobId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.provider ? ["providerJobId"] : ["provider"],
      message: "provider_and_provider_job_id_must_be_supplied_together",
    });
  }
});

export const ApplicationPatchSchema = z.object({
  company: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(120).optional(),
  status: ApplicationStatusSchema.optional(),
  jobUrl: httpUrl.nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  resumeId: z.string().uuid().nullable().optional(),
  resumeVariantLabel: ResumeVariantLabelSchema,
  followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
  targetSalaryMin: z.number().int().min(0).max(100_000_000).nullable().optional(),
  targetSalaryMax: z.number().int().min(0).max(100_000_000).nullable().optional(),
  offeredBase: z.number().int().min(0).max(100_000_000).nullable().optional(),
  compCurrency: z.string().trim().toUpperCase().length(3).nullable().optional(),
  equityNote: z.string().trim().max(300).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "application_patch_cannot_be_empty",
});

export const ApplicationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(500).optional(),
}).strict();

export type ApplicationCreateInput = z.infer<typeof ApplicationCreateSchema>;
export type ApplicationPatchInput = z.infer<typeof ApplicationPatchSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const LEGACY_APPLICATION_STATUS_MAP: Readonly<Record<string, ApplicationStatus>> = {
  pending: "saved",
  shortlisted: "saved",
  submitted: "applied",
  screening: "interview",
  accepted: "offer",
  declined: "rejected",
  withdrawn: "rejected",
};

export function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  const parsed = ApplicationStatusSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return typeof value === "string" && LEGACY_APPLICATION_STATUS_MAP[value]
    ? LEGACY_APPLICATION_STATUS_MAP[value]
    : "saved";
}
