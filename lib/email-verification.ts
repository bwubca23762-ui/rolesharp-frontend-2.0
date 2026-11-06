import { createHash, randomBytes } from "crypto";
import { q, type TransactionQuery } from "./db";
import { env } from "./env";
import { sendVerificationEmail } from "./email";

const VERIFY_TTL_HOURS = 24;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type PreparedVerification = {
  readonly id: number;
  readonly token: string;
  readonly email: string;
};

export async function prepareUserVerification(
  userId: string,
  email: string,
  query: TransactionQuery = q,
): Promise<PreparedVerification> {
  const token = randomBytes(32).toString("base64url");
  const cleanEmail = email.toLowerCase();
  const rows = await query<{ id: number }>(
    `insert into email_verification_tokens
       (user_id, email, token_hash, expires_at, delivery_status)
     values ($1, $2, $3, now() + interval '${VERIFY_TTL_HOURS} hours', 'pending')
     returning id`,
    [userId, cleanEmail, hashToken(token)],
  );
  if (!rows[0]) throw new Error("verification_token_not_created");
  return { id: rows[0].id, token, email: cleanEmail };
}

export async function deliverUserVerification(prepared: PreparedVerification) {
  const verifyUrl = `${env.siteUrl}/api/auth/verify-email?token=${encodeURIComponent(prepared.token)}`;
  try {
    await sendVerificationEmail(prepared.email, verifyUrl);
    await q(
      `update email_verification_tokens
       set delivery_status='sent', delivered_at=now(), delivery_error=null
       where id=$1 and delivery_status='pending'`,
      [prepared.id],
    );
    return true;
  } catch (error) {
    await q(
      `update email_verification_tokens
       set delivery_status='failed', delivery_error=$2
       where id=$1 and delivery_status='pending'`,
      [prepared.id, error instanceof Error ? error.message.slice(0, 500) : "email_send_failed"],
    ).catch(() => {});
    throw error;
  }
}

export async function sendUserVerification(userId: string, email: string) {
  const prepared = await prepareUserVerification(userId, email);
  await deliverUserVerification(prepared);
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashToken(token);
  const rows = await q<{ user_id: string; email: string; auth_version: number }>(
    `with eligible as (
       select t.id, t.user_id, t.email
       from email_verification_tokens t
       join users u on u.id=t.user_id
       where t.token_hash=$1
         and t.used_at is null
         and t.expires_at > now()
         and (lower(u.email)=lower(t.email) or lower(u.pending_email)=lower(t.email))
       for update of t
     ), consumed as (
       update email_verification_tokens t
       set used_at=now()
       from eligible e
       where t.id=e.id and t.used_at is null
       returning e.user_id, e.email
     )
     update users u
     set email=c.email,
         pending_email=null,
         email_verified_at=now(),
         auth_version=auth_version+1
     from consumed c
     where u.id=c.user_id
     returning u.id as user_id, u.email, u.auth_version`,
    [tokenHash],
  );
  return rows[0] ?? null;
}
