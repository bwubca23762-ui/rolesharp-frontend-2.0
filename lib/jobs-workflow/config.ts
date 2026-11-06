import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();
const score = z.coerce.number().int().min(0).max(100);

const RawJobsWorkflowEnvironment = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  JOB_WORKFLOW_NAMESPACE: z.string().trim().min(1).max(80).optional().default("development"),
  QUEUE_PREFIX: z.string().max(120).optional().default("rolesharp:dev:"),
  MAIL_TOKEN_KEYS: z.string().optional().default(""),
  MAIL_TOKEN_ACTIVE_KEY_VERSION: positiveInteger.optional(),
  MAIL_CALLBACK_ORIGINS: z.string().optional().default(""),
  APPLICATION_EMAIL_ADMIN_DAILY_LIMIT: z.coerce.number().int().min(1).max(5).optional().default(5),
  APPLICATION_EMAIL_FIT_FLOOR: score.optional().default(85),
  APPLICATION_EMAIL_CONFIDENCE_FLOOR: score.optional().default(80),
  GMAIL_CONNECTION_CLIENT_ID: z.string().trim().optional().default(""),
  GMAIL_CONNECTION_CLIENT_SECRET: z.string().trim().optional().default(""),
  GMAIL_CONNECTION_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_CONNECTION_CLIENT_ID: z.string().trim().optional().default(""),
  MICROSOFT_CONNECTION_CLIENT_SECRET: z.string().trim().optional().default(""),
  MICROSOFT_CONNECTION_REDIRECT_URI: z.string().url().optional(),
  JOBS_WORKFLOWS_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  ROLE_APPLY_GMAIL_SEND_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  ROLE_APPLY_MICROSOFT_SEND_ENABLED: z.enum(["true", "false"]).optional().default("false"),
}).passthrough();

function parseOrigins(raw: string, production: boolean): readonly string[] {
  const origins = raw.split(",").map((value) => value.trim()).filter(Boolean).map((value) => {
    const url = new URL(value);
    if (url.pathname !== "/" || url.search || url.hash) throw new Error("MAIL_CALLBACK_ORIGINS must contain origins only");
    if (production && url.protocol !== "https:") throw new Error("Production callback origins must use HTTPS");
    return url.origin;
  });
  return [...new Set(origins)].sort();
}

function parseKeys(raw: string): ReadonlyMap<number, Buffer> {
  const keys = new Map<number, Buffer>();
  if (!raw.trim()) return keys;
  for (const entry of raw.split(",")) {
    const [versionText, encoded, extra] = entry.trim().split(":");
    const version = Number(versionText);
    if (extra !== undefined || !Number.isInteger(version) || version <= 0 || !encoded) {
      throw new Error("MAIL_TOKEN_KEYS must use version:base64 entries");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64").replace(/=+$/u, "") !== encoded.replace(/=+$/u, "")) {
      throw new Error(`MAIL_TOKEN_KEYS version ${version} must be a canonical 32-byte base64 key`);
    }
    if (keys.has(version)) throw new Error(`MAIL_TOKEN_KEYS repeats version ${version}`);
    keys.set(version, key);
  }
  return keys;
}

export type JobsWorkflowConfig = ReturnType<typeof loadJobsWorkflowConfig>;
export type MailboxProvider = "google" | "microsoft";

export function loadJobsWorkflowConfig(source: NodeJS.ProcessEnv = process.env) {
  const raw = RawJobsWorkflowEnvironment.parse(source);
  const production = raw.NODE_ENV === "production";
  const keys = parseKeys(raw.MAIL_TOKEN_KEYS);
  const activeKeyVersion = raw.MAIL_TOKEN_ACTIVE_KEY_VERSION ?? 0;
  if ((activeKeyVersion > 0 || keys.size > 0) && !keys.has(activeKeyVersion)) {
    throw new Error("MAIL_TOKEN_ACTIVE_KEY_VERSION must identify a configured key");
  }
  if (raw.APPLICATION_EMAIL_FIT_FLOOR < 85 || raw.APPLICATION_EMAIL_CONFIDENCE_FLOOR < 80) {
    throw new Error("Application email score floors cannot be lower than 85 fit / 80 confidence");
  }
  const callbackOrigins = parseOrigins(raw.MAIL_CALLBACK_ORIGINS, production);
  const gmailConfigured = Boolean(
    raw.GMAIL_CONNECTION_CLIENT_ID && raw.GMAIL_CONNECTION_CLIENT_SECRET && raw.GMAIL_CONNECTION_REDIRECT_URI,
  );
  const microsoftConfigured = Boolean(
    raw.MICROSOFT_CONNECTION_CLIENT_ID && raw.MICROSOFT_CONNECTION_CLIENT_SECRET && raw.MICROSOFT_CONNECTION_REDIRECT_URI,
  );
  if (production && raw.ROLE_APPLY_GMAIL_SEND_ENABLED === "true" && (!gmailConfigured || keys.size === 0)) {
    throw new Error("Enabled Gmail connection requires credentials and MAIL_TOKEN_KEYS");
  }
  if (production && raw.ROLE_APPLY_MICROSOFT_SEND_ENABLED === "true" && (!microsoftConfigured || keys.size === 0)) {
    throw new Error("Enabled Microsoft connection requires credentials and MAIL_TOKEN_KEYS");
  }
  const redirects = [raw.GMAIL_CONNECTION_REDIRECT_URI, raw.MICROSOFT_CONNECTION_REDIRECT_URI]
    .filter((redirect): redirect is string => Boolean(redirect));
  for (const redirect of redirects) {
    const origin = new URL(redirect).origin;
    if (!callbackOrigins.includes(origin)) throw new Error(`Mailbox redirect origin is not allowlisted: ${origin}`);
  }
  return {
    namespace: raw.JOB_WORKFLOW_NAMESPACE,
    queuePrefix: raw.QUEUE_PREFIX,
    mailTokenKeys: keys,
    activeKeyVersion,
    callbackOrigins,
    applicationEmailAdminDailyLimit: raw.APPLICATION_EMAIL_ADMIN_DAILY_LIMIT,
    applicationEmailFitFloor: raw.APPLICATION_EMAIL_FIT_FLOOR,
    applicationEmailConfidenceFloor: raw.APPLICATION_EMAIL_CONFIDENCE_FLOOR,
    workflowsEnabled: raw.JOBS_WORKFLOWS_ENABLED === "true",
    gmail: {
      configured: gmailConfigured,
      clientId: raw.GMAIL_CONNECTION_CLIENT_ID,
      clientSecret: raw.GMAIL_CONNECTION_CLIENT_SECRET,
      redirectUri: raw.GMAIL_CONNECTION_REDIRECT_URI ?? "",
      sendEnabled: raw.ROLE_APPLY_GMAIL_SEND_ENABLED === "true",
    },
    microsoft: {
      configured: microsoftConfigured,
      clientId: raw.MICROSOFT_CONNECTION_CLIENT_ID,
      clientSecret: raw.MICROSOFT_CONNECTION_CLIENT_SECRET,
      redirectUri: raw.MICROSOFT_CONNECTION_REDIRECT_URI ?? "",
      sendEnabled: raw.ROLE_APPLY_MICROSOFT_SEND_ENABLED === "true",
    },
  } as const;
}

let cached: JobsWorkflowConfig | undefined;
export function jobsWorkflowConfig(): JobsWorkflowConfig {
  cached ??= loadJobsWorkflowConfig();
  return cached;
}

/**
 * OAuth connection routes must not construct an authorization URL from an
 * incomplete production configuration.  Aside from being confusing for a
 * candidate, an empty redirect URI could send the browser to a provider error
 * page that gives no actionable explanation.
 */
export function requireMailboxProviderConfiguration(
  provider: MailboxProvider,
  config = jobsWorkflowConfig(),
) {
  const selected = provider === "google" ? config.gmail : config.microsoft;
  if (!selected.configured) throw new Error("mailbox_provider_not_configured");
  return selected;
}

export function jobsWorkflowReadiness(config = jobsWorkflowConfig()) {
  return {
    namespace: config.namespace,
    tokenEncryption: config.mailTokenKeys.size > 0 && config.activeKeyVersion > 0,
    workflowsEnabled: config.workflowsEnabled,
    gmail: config.gmail.configured,
    microsoft: config.microsoft.configured,
    callbackOrigins: config.callbackOrigins.length > 0,
  };
}
