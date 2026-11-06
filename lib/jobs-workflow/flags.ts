import { q } from "../db";
import { jobsWorkflowConfig } from "./config";

export const PLATFORM_FLAGS = [
  "maintenance_mode",
  "signups_open",
  "google_oauth",
  "student_offer",
  "social_rewards",
  "telegram_rewards",
] as const;

export const JOB_WORKFLOW_FLAGS = [
  "jobs_daily_matches",
  "role_apply_prepare",
  "role_apply_gmail_send",
  "role_apply_microsoft_send",
] as const;

export type JobWorkflowFlag = (typeof JOB_WORKFLOW_FLAGS)[number];
export const ALLOWED_FEATURE_FLAGS = [...PLATFORM_FLAGS, ...JOB_WORKFLOW_FLAGS] as const;
export type AllowedFeatureFlag = (typeof ALLOWED_FEATURE_FLAGS)[number];
export type JobWorkflowFlagState = Readonly<Record<JobWorkflowFlag, boolean>>;

const disabledFlags = (): Record<JobWorkflowFlag, boolean> => ({
  jobs_daily_matches: false,
  role_apply_prepare: false,
  role_apply_gmail_send: false,
  role_apply_microsoft_send: false,
});

export async function readJobWorkflowFlags(): Promise<JobWorkflowFlagState> {
  try {
    const rows = await q<{ name: string; enabled: boolean }>(
      "select name,enabled from feature_flags where name=any($1::text[])",
      [JOB_WORKFLOW_FLAGS],
    );
    const state = disabledFlags();
    for (const row of rows) {
      if ((JOB_WORKFLOW_FLAGS as readonly string[]).includes(row.name)) {
        state[row.name as JobWorkflowFlag] = row.enabled === true;
      }
    }
    return state;
  } catch {
    return disabledFlags();
  }
}

export async function workflowFlagEnabled(flag: JobWorkflowFlag, userId?: string): Promise<boolean> {
  try {
    if (!jobsWorkflowConfig().workflowsEnabled) return false;
    if (userId) return (await q<{ enabled: boolean }>("select workflow_rollout_allows($1,$2::uuid) enabled", [flag, userId]))[0]?.enabled === true;
    return (await q<{ enabled: boolean }>("select (enabled and rollout_percent>0) enabled from feature_flags where name=$1", [flag]))[0]?.enabled === true;
  } catch {
    return false;
  }
}

export function providerSendFlag(provider: "google" | "microsoft"): JobWorkflowFlag {
  return provider === "google" ? "role_apply_gmail_send" : "role_apply_microsoft_send";
}

export function isAllowedFeatureFlag(value: unknown): value is AllowedFeatureFlag {
  return typeof value === "string" && (ALLOWED_FEATURE_FLAGS as readonly string[]).includes(value);
}

export async function providerSendEnabled(provider: "google" | "microsoft"): Promise<boolean> {
  try {
    const config = jobsWorkflowConfig();
    const providerConfig = provider === "google" ? config.gmail : config.microsoft;
    if (!config.workflowsEnabled || !providerConfig.configured || !providerConfig.sendEnabled) return false;
    return workflowFlagEnabled(providerSendFlag(provider));
  } catch {
    return false;
  }
}
