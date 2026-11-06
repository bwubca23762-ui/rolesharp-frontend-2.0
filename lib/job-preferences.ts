import { z } from "zod";
import { q } from "./db";

// Declared deal breakers (Phase 2 of the job-match upgrade). These are the
// user's own hard lines — a posting that violates one is vetoed regardless of
// how well it scores on skills. Absence of a row means no declared
// preferences: scoring behaves exactly as it did before this module existed.
//
// Declared languages are stored for profile matching but do NOT veto yet —
// postings do not carry extracted language requirements, so a veto would be
// ungrounded. When extraction grows language requirements, the veto joins
// here first.

export const JobPreferencesSchema = z.object({
  minSalary: z.number().int().min(0).max(100_000_000).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/u).default("USD"),
  remoteOnly: z.boolean().default(false),
  languages: z.array(z.string().trim().min(2).max(30)).max(10).default([]),
  // Location scope: in-country only, international only, or both (066).
  locationScope: z.enum(["in_country", "out_of_country", "both"]).default("both"),
  homeCountry: z.string().regex(/^[A-Z]{2}$/u).nullable().default(null),
  targetCountries: z.array(z.string().regex(/^[A-Z]{2}$/u)).max(20).default([]),
}).strict();
export type JobPreferencesInput = z.infer<typeof JobPreferencesSchema>;

export type JobPreferences = {
  minSalary: number;
  currency: string;
  remoteOnly: boolean;
  languages: string[];
  locationScope: "in_country" | "out_of_country" | "both";
  homeCountry: string | null;
  targetCountries: string[];
};

type Row = {
  min_salary: string | number;
  currency: string;
  remote_only: boolean;
  languages: string[] | null;
  location_scope?: string | null;
  home_country?: string | null;
  target_countries?: string[] | null;
};

function fromRow(row: Row): JobPreferences {
  return {
    minSalary: Number(row.min_salary ?? 0),
    currency: row.currency ?? "USD",
    remoteOnly: Boolean(row.remote_only),
    languages: Array.isArray(row.languages) ? row.languages : [],
    locationScope: (row.location_scope as JobPreferences["locationScope"]) || "both",
    homeCountry: row.home_country ?? null,
    targetCountries: Array.isArray(row.target_countries) ? row.target_countries : [],
  };
}

export async function getJobPreferences(userId: string): Promise<JobPreferences | null> {
  const rows = await q<Row>(
    `select min_salary, currency, remote_only, languages, location_scope, home_country, target_countries
     from user_job_preferences where user_id = $1`,
    [userId],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function saveJobPreferences(userId: string, input: JobPreferencesInput): Promise<JobPreferences> {
  const rows = await q<Row>(
    `insert into user_job_preferences
       (user_id, min_salary, currency, remote_only, languages, location_scope, home_country, target_countries)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (user_id) do update set
       min_salary = excluded.min_salary,
       currency = excluded.currency,
       remote_only = excluded.remote_only,
       languages = excluded.languages,
       location_scope = excluded.location_scope,
       home_country = excluded.home_country,
       target_countries = excluded.target_countries,
       updated_at = now()
     returning min_salary, currency, remote_only, languages, location_scope, home_country, target_countries`,
    [userId, input.minSalary, input.currency, input.remoteOnly, input.languages,
      input.locationScope, input.homeCountry ?? null, input.targetCountries],
  );
  return fromRow(rows[0]);
}
