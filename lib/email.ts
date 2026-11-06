import nodemailer from "nodemailer";
import { env } from "./env";
import { q } from "./db";
import { connection, redisDeadline } from "./queue";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  type?: string;
  /**
   * Provider-dependent. The bulk SMTP (nodemailer) path passes these through
   * verbatim — that is where List-Unsubscribe must land. The Cloudflare
   * Email Sending REST API has no custom-header field, so this path's
   * unsubscribe affordance remains the in-body link.
   */
  headers?: Record<string, string>;
};

export type MailStatus = "sent" | "queued";

// ── Daily send budget ──
// Cloudflare Email Sending has account-level quotas; this hard cap keeps a
// runaway loop (or an attack on the resend endpoints) from exhausting the
// day's budget and blocking ALL transactional mail, verification included.
// Configurable via EMAIL_DAILY_LIMIT; the counter resets at UTC midnight.
const EMAIL_DAILY_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT ?? "200");

async function emailDailyCount(): Promise<{ ok: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10); // UTC day
  const key = `mail:daily:${today}`;
  try {
    const n = await redisDeadline(() => connection.incr(key));
    if (n === 1) {
      // Expire at next UTC midnight + a small buffer so the key can never linger.
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 5, 0);
      const ttlSec = Math.max(60, Math.ceil((tomorrow.getTime() - Date.now()) / 1000));
      await redisDeadline(() => connection.expire(key, ttlSec));
    }
    return { ok: n <= EMAIL_DAILY_LIMIT, remaining: Math.max(0, EMAIL_DAILY_LIMIT - n) };
  } catch {
    // Redis unavailable: fail OPEN (allow the send). Blocking all transactional
    // email because Redis hiccupped would break verification entirely — the
    // opposite failure of what this cap exists to prevent.
    return { ok: true, remaining: -1 };
  }
}

function smtpReady() {
  return !!(env.smtpHost && env.smtpFrom);
}

// Treat placeholder junk ("undefined", "null", "changeme") as NOT configured —
// a literal CLOUDFLARE_ACCOUNT_ID=undefined once selected this path and produced
// a request to `/accounts/undefined/...`, 500-ing signup. Guard against it.
function realValue(v: string | undefined) {
  const s = (v ?? "").trim();
  return s && !["undefined", "null", "changeme", "none"].includes(s.toLowerCase()) ? s : "";
}
function cloudflareEmailReady() {
  return !!(realValue(env.cloudflareAccountId) && realValue(env.cloudflareEmailApiToken) && env.smtpFrom);
}

export function emailEnabled() {
  return cloudflareEmailReady() || smtpReady();
}

function parseFrom(from: string) {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (!match) return { address: from.trim(), name: undefined };
  return { name: match[1].replace(/^"|"$/g, "").trim(), address: match[2].trim() };
}

async function sendCloudflareMail(mail: Mail): Promise<MailStatus> {
  const from = parseFrom(env.smtpFrom);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/email/sending/send`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${env.cloudflareEmailApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: mail.to,
      from: from.name ? { address: from.address, name: from.name } : from.address,
      // The REST API spells this reply_to; the Workers binding spells it
      // replyTo, and passing the camelCase form here is rejected as an invalid
      // request schema. Omitted entirely when unset rather than sent as null.
      //
      // This was dropped on the floor before: the body carried only to/from/
      // subject/text/html, so the moment Cloudflare became the active transport
      // every contact-form reply went to SMTP_FROM instead of the person who
      // wrote in (app/api/contact/route.ts sets replyTo to the requester, and
      // lib/communications.ts sets it per campaign). Nothing errored — support
      // would simply have been answering into its own inbox.
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    const msg = data?.errors?.map((e: any) => e.message).join("; ") || `Cloudflare Email failed (${res.status})`;
    throw new Error(msg);
  }
  const result = data?.result || {};
  if (Array.isArray(result.permanent_bounces) && result.permanent_bounces.includes(mail.to)) {
    throw new Error("Recipient permanently bounced");
  }
  return Array.isArray(result.delivered) && result.delivered.includes(mail.to) ? "sent" : "queued";
}

// transport tags the delivering stream for email_log: "cloudflare" | "smtp"
// for the transactional paths here, "bulk:N" for the numbered pool in
// lib/bulk-mail.ts. Nullable in the table so pre-061 rows stay anonymous.
export async function logMail(mail: Mail, status: MailStatus | "failed", error?: unknown, transport?: string) {
  if (env.localDevMode) return;
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;
  await q(
    `insert into email_log (recipient, subject, type, status, error_msg, transport)
     values ($1,$2,$3,$4,$5,$6)`,
    [mail.to.toLowerCase(), mail.subject, mail.type || "transactional", status, errorMessage?.slice(0, 1000) || null, transport ?? null],
  ).catch((logError) => console.error("email audit log failed:", logError));
}

export async function sendMail(mail: Mail): Promise<MailStatus> {
  try {
    // Daily budget check before any transport. Verification mail is NOT exempt:
    // if the day's budget is gone, deferring is safer than silently degrading
    // the provider relationship — and the resend endpoint recovers it tomorrow.
    const budget = await emailDailyCount();
    if (!budget.ok) {
      console.error(`[email] daily limit of ${EMAIL_DAILY_LIMIT} reached; dropping "${mail.type ?? "transactional"}" to ${mail.to}`);
      await logMail(mail, "failed", `daily_email_limit_reached (remaining ${budget.remaining})`);
      throw new Error("Daily email sending limit reached. Try again tomorrow.");
    }

    if (cloudflareEmailReady()) {
      const status = await sendCloudflareMail(mail);
      await logMail(mail, status, undefined, "cloudflare");
      return status;
    }

    if (!smtpReady()) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Email transport is not configured");
      }
      console.log("[email:dev]", JSON.stringify({ type: mail.type ?? "transactional", subject: mail.subject }));
      return "queued";
    }

    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      ignoreTLS: env.smtpIgnoreTls,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: env.smtpUser || env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });

    const result = await transporter.sendMail({
      from: env.smtpFrom,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
    if (result.rejected?.includes(mail.to)) throw new Error("SMTP rejected the recipient");
    // SMTP acceptance means the upstream transport queued the message. It is
    // not proof of final inbox delivery, so Admin must not label it "sent".
    await logMail(mail, "queued", undefined, "smtp");
    return "queued";
  } catch (error) {
    await logMail(mail, "failed", error);
    throw error;
  }
}

export async function sendVerificationEmail(email: string, verifyUrl: string) {
  const escapedUrl = verifyUrl.replace(/"/g, "&quot;");
  await sendMail({
    to: email,
    type: "verification",
    subject: "Verify your RoleSharp email",
    text: `Verify your RoleSharp account: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Verify your RoleSharp account</h2>
        <p>Confirm this email address so you can log in and save resumes.</p>
        <p><a href="${escapedUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700">Verify email</a></p>
        <p style="color:#64748b;font-size:13px">This link expires in 24 hours. If the button does not work, copy this link:</p>
        <p style="word-break:break-all;color:#334155">${escapedUrl}</p>
      </div>
    `,
  });
}
