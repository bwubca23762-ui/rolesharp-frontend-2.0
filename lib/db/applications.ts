import { z } from "zod";
import {
  APPLICATION_STATUSES,
  type ApplicationCreateInput,
  type ApplicationPatchInput,
  type ApplicationStatus,
} from "../applications/contracts";
import { q, type TransactionQuery, withTransaction } from "./core";

export const APP_STATUSES = APPLICATION_STATUSES;
export type AppStatus = ApplicationStatus;

export type ApplicationErrorCode =
  | "duplicate_application"
  | "invalid_cursor"
  | "job_identity_mismatch"
  | "job_not_found"
  | "resume_not_owned";

export class ApplicationDomainError extends Error {
  readonly name = "ApplicationDomainError";

  constructor(readonly code: ApplicationErrorCode) {
    super(code);
  }
}

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: AppStatus;
  job_url: string | null;
  notes: string | null;
  resume_id: string | null;
  resume_variant_label: string | null;
  job_id: string | null;
  provider_namespace: string | null;
  provider_job_id: string | null;
  canonical_job_key: string | null;
  follow_up_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const CursorSchema = z.object({
  updatedAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

function encodeCursor(row: ApplicationRow): string {
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString();
  return Buffer.from(JSON.stringify({ updatedAt, id: row.id }), "utf8").toString("base64url");
}

function decodeCursor(value: string): z.infer<typeof CursorSchema> {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = CursorSchema.safeParse(decoded);
    if (parsed.success) return parsed.data;
  } catch {
    // The stable domain error below intentionally hides parser details.
  }
  throw new ApplicationDomainError("invalid_cursor");
}

function hasPostgresCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === code;
}

async function assertResumeOwnership(
  query: TransactionQuery,
  userId: string,
  resumeId: string | null | undefined,
): Promise<void> {
  if (!resumeId) return;
  const owned = await query<{ id: string }>(
    "select id from resumes where id=$1 and user_id_text=$2 for key share",
    [resumeId, userId],
  );
  if (!owned[0]) throw new ApplicationDomainError("resume_not_owned");
}

async function resolveJobIdentity(
  query: TransactionQuery,
  input: ApplicationCreateInput,
): Promise<{ jobId: string | null; provider: string | null; providerJobId: string | null }> {
  if (!input.jobId) {
    return {
      jobId: null,
      provider: input.provider ?? null,
      providerJobId: input.providerJobId ?? null,
    };
  }
  const job = await query<{ id: string; provider: string; external_id: string }>(
    "select id,provider,external_id from jobs where id=$1",
    [input.jobId],
  );
  if (!job[0]) throw new ApplicationDomainError("job_not_found");
  if ((input.provider && input.provider !== job[0].provider) ||
      (input.providerJobId && input.providerJobId !== job[0].external_id)) {
    throw new ApplicationDomainError("job_identity_mismatch");
  }
  return { jobId: job[0].id, provider: job[0].provider, providerJobId: job[0].external_id };
}

export async function listApplications(
  userId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<{ applications: ApplicationRow[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const rows = await q<ApplicationRow>(
    `select id,company,role,status,job_url,notes,resume_id,resume_variant_label,job_id,
            provider_namespace,provider_job_id,canonical_job_key,follow_up_at,
            created_at,updated_at
     from applications
     where user_id_text=$1
       and ($2::timestamptz is null or (updated_at,id) < ($2::timestamptz,$3::uuid))
     order by updated_at desc,id desc
     limit $4`,
    [userId, cursor?.updatedAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const hasMore = rows.length > limit;
  const applications = hasMore ? rows.slice(0, limit) : rows;
  return {
    applications,
    nextCursor: hasMore && applications.length > 0 ? encodeCursor(applications[applications.length - 1]) : null,
  };
}

export async function createApplication(userId: string, application: ApplicationCreateInput): Promise<string> {
  try {
    return await withTransaction(async (query) => {
      await assertResumeOwnership(query, userId, application.resumeId);
      // T7 passive data collection: snapshot the linked resume's ATS score at
      // application time so we can later correlate fit with outcomes.
      let fitScore: number | null = null;
      if (application.resumeId) {
        const scoreRow = await query<{ ats_score: number | null }>(
          "select ats_score from resumes where id=$1",
          [application.resumeId],
        );
        fitScore = scoreRow[0]?.ats_score ?? null;
      }
      const identity = await resolveJobIdentity(query, application);
      const rows = await query<{ id: string }>(
        `insert into applications (
           user_id_text,company,role,status,job_url,notes,resume_id,resume_variant_label,job_id,
           provider_namespace,provider_job_id,source_kind,fit_score,
           comp_target_min,comp_target_max,comp_offered_base,comp_currency,comp_equity_note
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         returning id`,
        [
          userId,
          application.company,
          application.role,
          application.status,
          application.jobUrl ?? null,
          application.notes ?? null,
          application.resumeId ?? null,
          application.resumeVariantLabel ?? null,
          identity.jobId,
          identity.provider,
          identity.providerJobId,
          identity.jobId ? "jobs_index" : "manual",
          fitScore,
          application.targetSalaryMin ?? null,
          application.targetSalaryMax ?? null,
          application.offeredBase ?? null,
          application.compCurrency ?? null,
          application.equityNote ?? null,
        ],
      );
      if (!rows[0]) throw new Error("application_insert_failed");
      return rows[0].id;
    });
  } catch (error) {
    if (hasPostgresCode(error, "23505")) throw new ApplicationDomainError("duplicate_application");
    throw error;
  }
}

export async function updateApplication(
  userId: string,
  id: string,
  patch: ApplicationPatchInput,
): Promise<boolean> {
  return withTransaction(async (query) => {
    if (patch.resumeId !== undefined) await assertResumeOwnership(query, userId, patch.resumeId);
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column}=$${values.length}`);
    };
    if (patch.status !== undefined) add("status", patch.status);
    if (patch.notes !== undefined) add("notes", patch.notes);
    if (patch.jobUrl !== undefined) add("job_url", patch.jobUrl);
    if (patch.company !== undefined) add("company", patch.company);
    if (patch.role !== undefined) add("role", patch.role);
    if (patch.resumeId !== undefined) {
      // Re-snapshot the ATS score when the linked resume changes (T7).
      // Null (unlink) clears the snapshot too: a fit_score on an application
      // with no resume is a phantom data point in outcome-by-score analysis.
      if (patch.resumeId) {
        const scoreRow = await query<{ ats_score: number | null }>(
          "select ats_score from resumes where id=$1",
          [patch.resumeId],
        );
        add("fit_score", scoreRow[0]?.ats_score ?? null);
      } else {
        add("fit_score", null);
      }
      add("resume_id", patch.resumeId);
    }
    if (patch.followUpAt !== undefined) add("follow_up_at", patch.followUpAt);
    if (patch.resumeVariantLabel !== undefined) add("resume_variant_label", patch.resumeVariantLabel);
    if (patch.targetSalaryMin !== undefined) add("comp_target_min", patch.targetSalaryMin);
    if (patch.targetSalaryMax !== undefined) add("comp_target_max", patch.targetSalaryMax);
    if (patch.offeredBase !== undefined) add("comp_offered_base", patch.offeredBase);
    if (patch.compCurrency !== undefined) add("comp_currency", patch.compCurrency);
    if (patch.equityNote !== undefined) add("comp_equity_note", patch.equityNote);
    sets.push("updated_at=now()");
    values.push(id, userId);
    const rows = await query<{ id: string }>(
      `update applications set ${sets.join(",")}
       where id=$${values.length - 1} and user_id_text=$${values.length}
       returning id`,
      values,
    );
    return rows.length > 0;
  });
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  const rows = await q<{ id: string }>(
    "delete from applications where id=$1 and user_id_text=$2 returning id",
    [id, userId],
  );
  return rows.length > 0;
}

export type VariantOutcomeAggregate = {
  label: string;
  total: number;
  sent: number;
  interviews: number;
  offers: number;
  rejections: number;
  lastUsed: string | null;
};

// Raw per-label counts for the variant insights tab. "Sent" means the
// candidate moved the application past saved (their own record of having
// applied); responses are interviews, offers, and rejections. Labels are
// the candidate's own tags — no identity or PII, safe to aggregate as-is.
export async function variantOutcomes(userId: string): Promise<VariantOutcomeAggregate[]> {
  const rows = await q<{
    label: string;
    total: string | number;
    sent: string | number;
    interviews: string | number;
    offers: string | number;
    rejections: string | number;
    last_used: Date | string | null;
  }>(
    `select resume_variant_label as label,
            count(*)::int as total,
            count(*) filter (where status <> 'saved')::int as sent,
            count(*) filter (where status = 'interview')::int as interviews,
            count(*) filter (where status = 'offer')::int as offers,
            count(*) filter (where status = 'rejected')::int as rejections,
            max(updated_at) as last_used
     from applications
     where user_id_text=$1 and resume_variant_label is not null
     group by resume_variant_label
     order by sent desc, total desc, resume_variant_label asc`,
    [userId],
  );
  return rows.map((row) => ({
    label: row.label,
    total: Number(row.total),
    sent: Number(row.sent),
    interviews: Number(row.interviews),
    offers: Number(row.offers),
    rejections: Number(row.rejections),
    lastUsed:
      row.last_used instanceof Date
        ? row.last_used.toISOString()
        : row.last_used
          ? new Date(row.last_used).toISOString()
          : null,
  }));
}
