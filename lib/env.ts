// Centralized runtime configuration. Invalid values fail during process startup
// instead of flowing into quotas, pricing, queue limits, or timeout arithmetic as
// NaN, Infinity, negative values, or silently disabled booleans.
import {
  DEFAULT_DAYS_MONTHLY,
  DEFAULT_DAYS_YEARLY,
  DEFAULT_FREE_MONTHLY_LIMIT,
  DEFAULT_PREMIUM_MONTHLY_LIMIT,
  DEFAULT_REFERRAL_CREDIT_REWARD,
  DEFAULT_REFERRAL_MONTHLY_CAP,
  DEFAULT_STUDENT_MONTHLY_LIMIT,
} from "./limits";

function reqFrom(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optionalText(source: NodeJS.ProcessEnv, name: string, fallback = ""): string {
  return source[name]?.trim() || fallback;
}

function integer(
  source: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = source[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function optionalInteger(
  source: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number,
): number | null {
  const raw = source[name]?.trim();
  if (!raw) return null;
  return integer(source, name, 0, minimum, maximum);
}

function boolean(source: NodeJS.ProcessEnv, name: string, fallback = false): boolean {
  const raw = source[name]?.trim();
  if (!raw) return fallback;
  if (raw !== "true" && raw !== "false") throw new Error(`${name} must be true or false`);
  return raw === "true";
}

function currency(source: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = optionalText(source, name, fallback).toUpperCase();
  if (!/^[A-Z]{3}$/u.test(value)) throw new Error(`${name} must be a three-letter currency code`);
  return value;
}

function publicSiteUrl(source: NodeJS.ProcessEnv): string {
  // A production build must never silently bake localhost, an origin IP, or a
  // staging host into canonical URLs, Open Graph tags, robots, or sitemaps.
  // LOCAL_DEV_MODE is an explicit escape hatch for local production builds.
  const production = source.NODE_ENV === "production" && !boolean(source, "LOCAL_DEV_MODE");
  const raw = source.SITE_URL ?? (production ? "https://rolesharp.com" : "http://localhost:3000");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`SITE_URL must be an absolute URL, got: ${raw}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`SITE_URL must use http or https, got: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" ||
    /^\d{1,3}(\.\d{1,3}){3}$/u.test(host);
  if (production && (local || parsed.protocol !== "https:")) {
    throw new Error("Production SITE_URL must be an HTTPS public hostname, not localhost or an IP address");
  }
  return parsed.origin;
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const nodeEnv = optionalText(source, "NODE_ENV", "development");
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const localDevMode = boolean(source, "LOCAL_DEV_MODE");
  const authSecret = optionalText(source, "AUTH_SECRET");
  // LOCAL_DEV_MODE used to excuse a missing AUTH_SECRET even in production,
  // which fell back to the published "dev-insecure-secret-change-me" constant
  // below. That secret derives the JWE key, so anyone could have minted a valid
  // session cookie for any account. Production now fails closed regardless of
  // any other flag: there is no legitimate production use of a shared secret
  // that is checked into the repository.
  if (nodeEnv === "production" && !authSecret) {
    throw new Error("Missing env: AUTH_SECRET");
  }
  const disableDb = boolean(source, "DISABLE_DB");
  const databaseUrl = disableDb ? "" : optionalText(source, "DATABASE_URL");
  if (nodeEnv === "production" && !localDevMode && !disableDb && !databaseUrl) {
    throw new Error("Missing env: DATABASE_URL");
  }

  return {
    nodeEnv: nodeEnv as "development" | "test" | "production",
    production: nodeEnv === "production",
    localDevMode,
    authSecret: authSecret || "dev-insecure-secret-change-me",
    llmKey: optionalText(source, "OPENAI_API_KEY"),
    llmBase: optionalText(source, "OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
    llmModel: optionalText(source, "LLM_MODEL", "gemini-2.5-flash"),
    embedModel: optionalText(source, "EMBED_MODEL", "gemini-embedding-001"),
    redisUrl: optionalText(source, "REDIS_URL", "redis://localhost:6379"),
    // Voice interview (VOICE-INTERVIEW-PLAN): service-account auth for Vertex
    // AI. The key is either a file path (preferred — the secret never lands in
    // an env value) or an inline JSON blob (the VPS path). Absent or disabled
    // = voice features answer "unconfigured" instead of calling anything.
    gcpServiceAccountFile: optionalText(source, "GCP_SERVICE_ACCOUNT_FILE"),
    gcpServiceAccountJson: optionalText(source, "GCP_SERVICE_ACCOUNT_JSON"),
    gcpVoiceProject: optionalText(source, "GCP_VOICE_PROJECT", "rolesharp"),
    gcpVoiceLocation: optionalText(source, "GCP_VOICE_LOCATION", "us-central1"),
    gcpVoiceEnabled: boolean(source, "GCP_VOICE_ENABLED"),
    // Explicit offline-build switch. An empty DATABASE_URL can be replaced by
    // Next's dotenv loading, so verification needs an unambiguous opt-out.
    databaseUrl,
    proxyUrl: optionalText(source, "ANTHROPIC_PROXY_URL"),
    proxyModel: optionalText(source, "PROXY_MODEL", "claude-sonnet-4-6"),
    proxyToken: optionalText(source, "ANTHROPIC_AUTH_TOKEN", "test"),
    bynaraBase: optionalText(source, "BYNARA_BASE_URL", "https://router.bynara.id/v1"),
    bynaraKey: optionalText(source, "BYNARA_API_KEY"),
    bynaraModel: optionalText(source, "BYNARA_MODEL", "claude-sonnet-4.6"),
    bynaraRpm: integer(source, "BYNARA_RPM", 10, 1, 10_000),
    atomesusBase: optionalText(source, "ATOMESUS_BASE_URL", "https://api.atomesus.com/v1"),
    atomesusKey: optionalText(source, "ATOMESUS_API_KEY"),
    atomesusModel: optionalText(source, "ATOMESUS_MODEL", "cipher"),
    workerConcurrency: integer(source, "WORKER_CONCURRENCY", 8, 1, 128),
    maxQueueDepth: integer(source, "MAX_QUEUE_DEPTH", 2_000, 1, 1_000_000),
    siteUrl: publicSiteUrl(source),
    adminUser: optionalText(source, "ADMIN_USER", "admin"),
    adminPassword: optionalText(source, "ADMIN_PASSWORD"),
    adminTotpSecret: optionalText(source, "ADMIN_TOTP_SECRET"),
    sessionIdleHours: integer(source, "SESSION_IDLE_HOURS", 72, 1, 720),
    adminIdleMinutes: integer(source, "ADMIN_IDLE_MINUTES", 30, 1, 480),
    googleClientId: optionalText(source, "GOOGLE_CLIENT_ID"),
    googleClientSecret: optionalText(source, "GOOGLE_CLIENT_SECRET"),
    staffGoogleClientId: optionalText(source, "STAFF_GOOGLE_CLIENT_ID"),
    staffGoogleClientSecret: optionalText(source, "STAFF_GOOGLE_CLIENT_SECRET"),
    staffOwnerEmail: optionalText(source, "STAFF_OWNER_EMAIL").toLowerCase(),
    staffAllowedDomain: optionalText(source, "STAFF_ALLOWED_DOMAIN").toLowerCase(),
    smtpHost: optionalText(source, "SMTP_HOST"),
    smtpPort: integer(source, "SMTP_PORT", 587, 1, 65_535),
    smtpSecure: boolean(source, "SMTP_SECURE"),
    smtpIgnoreTls: boolean(source, "SMTP_IGNORE_TLS"),
    smtpUser: optionalText(source, "SMTP_USER"),
    smtpPass: optionalText(source, "SMTP_PASS"),
    smtpFrom: optionalText(source, "SMTP_FROM"),
    cloudflareAccountId: optionalText(source, "CLOUDFLARE_ACCOUNT_ID"),
    cloudflareEmailApiToken: optionalText(source, "CLOUDFLARE_EMAIL_API_TOKEN"),
    referralCreditReward: integer(source, "REFERRAL_CREDIT_REWARD", DEFAULT_REFERRAL_CREDIT_REWARD, 1, 100),
    // The rolling-30-day ceiling on referral credits. Was a bare `>= 3` in
    // lib/credits.ts while three separate pages advertised the number.
    referralMonthlyCap: integer(source, "REFERRAL_MONTHLY_CAP", DEFAULT_REFERRAL_MONTHLY_CAP, 1, 1_000),
    // Tight on purpose: credits are the currency, and a roomy free tier meant
    // nobody ever needed one. The defaults live in lib/limits.ts so client
    // components can state the same numbers without importing this module.
    // tests/frontend-regression.test.ts fails if a page hardcodes them again.
    freeMonthlyLimit: integer(source, "FREE_MONTHLY_LIMIT", DEFAULT_FREE_MONTHLY_LIMIT, 0, 10_000),
    premiumMonthlyLimit: integer(source, "PREMIUM_MONTHLY_LIMIT", DEFAULT_PREMIUM_MONTHLY_LIMIT, 1, 10_000),
    studentMonthlyLimit: integer(source, "STUDENT_MONTHLY_LIMIT", DEFAULT_STUDENT_MONTHLY_LIMIT, 1, 10_000),
    premiumCurrency: currency(source, "PREMIUM_CURRENCY", "USD"),
    priceMonthlyCents: integer(source, "PRICE_MONTHLY_CENTS", 1_200, 1, 100_000_000),
    priceYearlyCents: integer(source, "PRICE_YEARLY_CENTS", 7_900, 1, 100_000_000),
    // Razorpay is a separate INR checkout. Amounts are deliberately required
    // instead of deriving them from USD plan prices: an implicit conversion
    // would make a financial decision at deploy time and can charge the wrong
    // amount when exchange rates or pricing change.
    razorpayKeyId: optionalText(source, "RAZORPAY_KEY_ID"),
    razorpayKeySecret: optionalText(source, "RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: optionalText(source, "RAZORPAY_WEBHOOK_SECRET"),
    razorpayCurrency: currency(source, "RAZORPAY_CURRENCY", "INR"),
    razorpayMonthlyAmountPaise: optionalInteger(source, "RAZORPAY_MONTHLY_AMOUNT_PAISE", 100, 100_000_000),
    razorpayYearlyAmountPaise: optionalInteger(source, "RAZORPAY_YEARLY_AMOUNT_PAISE", 100, 100_000_000),
    daysMonthly: integer(source, "DAYS_MONTHLY", DEFAULT_DAYS_MONTHLY, 1, 3_650),
    daysYearly: integer(source, "DAYS_YEARLY", DEFAULT_DAYS_YEARLY, 1, 3_650),
    studentDomainDailyCap: integer(source, "STUDENT_DOMAIN_DAILY_CAP", 30, 1, 100_000),
    // Student offer kill switch (migration 065 flips the DB flag off too).
    // Default false: reopening the program is a deliberate act.
    studentOfferEnabled: boolean(source, "STUDENT_OFFER_ENABLED"),
    // Social follow rewards master switch on top of the DB feature flag.
    socialRewardsEnabled: boolean(source, "SOCIAL_REWARDS_ENABLED", true),
    get googleEnabled() {
      return Boolean(this.googleClientId && this.googleClientSecret);
    },
    get staffGoogleEnabled() {
      return Boolean(this.staffGoogleClientId && this.staffGoogleClientSecret);
    },
    req(name: string) {
      return reqFrom(source, name);
    },
  } as const;
}

export const env = loadEnvironment();
