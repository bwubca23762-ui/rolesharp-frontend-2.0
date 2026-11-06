import { createHash, createHmac, randomBytes } from "crypto";
import { q, withTransaction, type TransactionQuery } from "./db";
import { env } from "./env";
import { PLANS } from "./entitlements";
import { formatPlanPrice, tailoredResumes } from "./limits";
import { sendMail } from "./email";
import { sellerFromEnv } from "./invoice";
import {
  currentStudentOffer,
  currentStudentOfferSummary,
  offerSnapshotParams,
  pinnedOfferVersion,
  publicOfferSummary,
  type OfferVersionPin,
  type PublicOfferSummary,
} from "./offers";

// Legacy exports remain for compatibility only. Enforcement and user-facing
// facts are read from the exact immutable offer version pinned to the token.
export const STUDENT_DAYS = 180;
export const STUDENT_TOKEN_TTL_HOURS = 24;

/* ────────────────────────── academic email validation ────────────────────────── */

// Free-mail providers explicitly rejected even if someone finds a pattern hole.
const BLOCKED_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "zoho.com", "mail.com", "gmx.com",
  "yandex.com", "yandex.ru", "rediffmail.com", "qq.com", "163.com", "126.com",
]);

// Known-abused "academic" domains: alumni-forever providers, resold .edu
// mailboxes, and self-service signup schools that fraud rings use. Extend at
// runtime via STUDENT_BLOCKED_DOMAINS=dom1,dom2 (no redeploy needed) as abuse
// is spotted in the admin Actions log.
const ABUSED_ACADEMIC = new Set([
  ...(process.env.STUDENT_BLOCKED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
]);

// Academic domain shapes, not a lazy `.edu$`:
//   *.edu            US and institutions worldwide on the .edu TLD
//   *.edu.<cc>       edu.in, edu.au, edu.cn, edu.sg, edu.my, edu.pk, edu.bd, ...
//   *.ac.<cc>        ac.uk, ac.in, ac.jp, ac.nz, ac.za, ac.kr, ac.th, ...
// Plus named universities whose country does not use an academic TLD shape at
// all — Canada (.ca), Germany (.de), Switzerland (.ch), Sweden (.se),
// France (.fr/.eu), the Netherlands (.nl), Ireland (.ie). Without this list,
// every student at Toronto, TUM, ETH, KTH, TU Delft, or Trinity College was
// locked out of the student offer while US .edu mailboxes sailed through.
// Sources: each university's own domain; curated to the institutions a
// recruiter would recognize, not a bulk TLD trust (a blanket *.ca/*.de/*.se
// would admit any registrant in those ccTLDs, which is exactly the fraud
// surface the abuse list exists to police).
const KNOWN_UNIVERSITY_DOMAINS = new Set([
  // Canada
  "utoronto.ca", "uwaterloo.ca", "mcgill.ca", "ubc.ca", "mcmaster.ca", "ualberta.ca",
  "ucalgary.ca", "queensu.ca", "uwo.ca", "sfu.ca", "uottawa.ca", "umanitoba.ca",
  "dal.ca", "usask.ca", "uvic.ca", "yorku.ca", "concordia.ca", "uqam.ca",
  // Germany
  "tum.de", "rwth-aachen.de", "uni-muenchen.de", "tu-berlin.de", "uni-heidelberg.de",
  "fu-berlin.de", "uni-frankfurt.de", "uni-koeln.de", "uni-hamburg.de", "uni-stuttgart.de",
  "tu-darmstadt.de", "uni-bonn.de", "uni-goettingen.de", "uni-freiburg.de", "tu-dresden.de",
  "leibniz-hannover.de", "rub.de", "uni-wuerzburg.de", "uni-muenster.de", "uni-bielefeld.de",
  "kiel.de", "rptu.de", "saarland.de", "magdeburg.de", "hu-berlin.de", "tuhh.de",
  // Switzerland
  "ethz.ch", "epfl.ch", "uzh.ch", "unibas.ch", "unige.ch", "unibe.ch", "unil.ch",
  "unisg.ch", "usys.ethz.ch", "unifr.ch", "unine.ch", "usi.ch",
  // Sweden
  "kth.se", "lu.se", "uu.se", "chalmers.se", "liu.se", "umu.se", "su.se", "gu.se",
  "ltu.se", "lth.se", "mdh.se", "mdu.se", "oru.se", "hb.se", "lnu.se", "slu.se",
  // France / EU
  "sorbonne-universite.fr", "universite-paris-saclay.fr", "psl.eu", "polytechnique.edu",
  "ens-paris-saclay.fr", "sciencespo.fr", "dauphine.psl.eu", "u-bordeaux.fr", "univ-lyon1.fr",
  "univ-amu.fr", "ut-capitole.fr", "univ-nantes.fr", "univ-rennes1.fr", "unistra.fr",
  "u-paris.fr", "centralesupelec.fr", "em-lyon.com", "hec.edu", "inria.fr",
  // Netherlands
  "tudelft.nl", "uva.nl", "uu.nl", "tue.nl", "utwente.nl", "rug.nl", "leidenuniv.nl",
  "vu.nl", "wur.nl", "ru.nl", "tilburguniversity.edu", "eur.nl", "maastrichtuniversity.nl",
  // Ireland
  "tcd.ie", "ucd.ie", "nuigalway.ie", "ul.ie", "dcu.ie", "maynooth.ie", "ucc.ie", "ucdconnect.ie",
  // Runtime extension: STUDENT_ALLOWED_DOMAINS=a.edu,b.edu adds to this set
  // without a redeploy, mirroring the STUDENT_BLOCKED_DOMAINS escape valve.
  ...(process.env.STUDENT_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
]);

const ACADEMIC_RE = /(\.edu|\.edu\.[a-z]{2,3}|\.ac\.[a-z]{2,3})$/;

// Kill switch (migration 065 flips the flag off; reseller cleanup). Both the
// env switch and the DB feature flag must say yes — either alone closing is
// enough to stop new tokens. Existing grants run out naturally; nothing here
// touches premium_until.
export async function isStudentOfferActive(): Promise<boolean> {
  if (!env.studentOfferEnabled) return false;
  try {
    const rows = await q<{ enabled: boolean }>(
      "select enabled from feature_flags where name='student_offer'",
    );
    return Boolean(rows[0]?.enabled);
  } catch {
    // If the flag table is unreachable, fail CLOSED — no new tokens.
    return false;
  }
}

export function isAcademicEmail(email: string): boolean {
  const clean = String(email || "").trim().toLowerCase();
  // Length guard + split-based parse instead of one regex. The old pattern
  // `[a-z0-9.-]+\.[a-z]{2,}` was ReDoS-prone: `.` lived in both the class and
  // the following literal, so a crafted local/domain caused catastrophic
  // backtracking. Splitting on "@" removes the ambiguity entirely.
  if (clean.length > 254) return false;
  const at = clean.indexOf("@");
  if (at <= 0 || at !== clean.lastIndexOf("@")) return false;
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  if (!/^[a-z0-9._%+-]+$/.test(local)) return false;
  // Linear domain validation: split into labels, check each against a simple
  // anchored class (no nested quantifiers = no backtracking), require 2+
  // labels and a 2+ letter TLD.
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const labelOk = (l: string) => /^[a-z0-9-]+$/.test(l);
  if (!labels.every(labelOk)) return false;
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  // Match the domain AND every parent against the abuse list, so blocking
  // "scam-college.edu" also blocks "mail.scam-college.edu".
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (ABUSED_ACADEMIC.has(parts.slice(i).join("."))) return false;
  }
  // Shape match first, then the named-university list: exact domain or any
  // parent (student.mail.kth.se matches kth.se the same way the abuse list
  // matches parents). The block list runs FIRST, so a blocked parent always
  // overrides an allowed one.
  if (ACADEMIC_RE.test(domain)) return true;
  for (let i = 0; i < parts.length - 1; i++) {
    if (KNOWN_UNIVERSITY_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

// Claim key: lower-cased, plus-tag stripped, so alice+1@x.edu and alice+2@x.edu
// cannot claim twice.
export function normalizeStudentEmail(email: string): string {
  const clean = String(email || "").trim().toLowerCase();
  const [local, domain] = clean.split("@");
  return `${(local || "").split("+")[0]}@${domain || ""}`;
}

/* ────────────────────────── tokens ────────────────────────── */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type PreparedStudentVerification = {
  readonly id: number;
  readonly token: string;
  readonly studentEmail: string;
  readonly offer: OfferVersionPin;
};

export async function createStudentToken(
  userId: string,
  studentEmail: string,
  query: TransactionQuery = q,
  ip: string | null = null,
): Promise<PreparedStudentVerification> {
  const token = randomBytes(32).toString("base64url");
  const offer = await currentStudentOffer(query);
  const [offerVersionId, offerKey, offerVersionNumber, contentDigest, terms] = offerSnapshotParams(offer);
  const rows = await query<{ id: number }>(
    `insert into student_verification_tokens
       (user_id, student_email, token_hash, expires_at, delivery_status,
        offer_version_id,offer_key,offer_version_number,offer_content_digest_snapshot,offer_terms_snapshot,request_ip)
     values ($1,$2,$3,now() + ($4 || ' hours')::interval,'pending',$5,$6,$7,$8,$9,$10)
     returning id`,
    [
      userId,
      studentEmail,
      hashToken(token),
      String(offer.terms.verification.tokenTtlHours),
      offerVersionId,
      offerKey,
      offerVersionNumber,
      contentDigest,
      terms,
      ip && ip !== "unknown" ? ip : null,
    ],
  );
  if (!rows[0]) throw new Error("student_token_not_created");
  return { id: rows[0].id, token, studentEmail, offer };
}

export async function deliverStudentVerification(
  prepared: PreparedStudentVerification,
  recipient: string,
) {
  const confirmUrl = `${env.siteUrl}/api/student/confirm?token=${encodeURIComponent(prepared.token)}`;
  try {
    await sendStudentVerifyEmail(recipient, confirmUrl, publicOfferSummary(prepared.offer));
    await q(
      `update student_verification_tokens
       set delivery_status='sent', delivered_at=now(), delivery_error=null
       where id=$1 and delivery_status='pending'`,
      [prepared.id],
    );
    return true;
  } catch (error) {
    await q(
      `update student_verification_tokens
       set delivery_status='failed', delivery_error=$2
       where id=$1 and delivery_status='pending'`,
      [prepared.id, error instanceof Error ? error.message.slice(0, 500) : "email_send_failed"],
    ).catch(() => {});
    throw error;
  }
}

export async function consumeStudentToken(token: string) {
  const rows = await q<{ id: number; user_id: string; student_email: string; offer_version_id: string }>(
    `update student_verification_tokens
     set used_at=now()
     where id = (
       select id
       from student_verification_tokens
       where token_hash=$1 and used_at is null and expires_at > now()
       order by id
       for update skip locked
       limit 1
     )
     returning id, user_id, student_email, offer_version_id`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export type StudentActivationResult =
  | { readonly kind: "invalid" }
  | { readonly kind: "claimed" }
  | {
      readonly kind: "activated";
      readonly studentEmail: string;
      readonly premiumUntil: string;
      readonly offer: PublicOfferSummary;
    };

class StudentAccountMissingError extends Error {
  readonly name = "StudentAccountMissingError";
}

export async function activateStudentOffer(token: string): Promise<StudentActivationResult> {
  return withTransaction(async (query) => {
    const found = await query<{
      user_id: string;
      student_email: string;
      offer_version_id: string;
      offer_key: string;
      offer_version_number: number;
      offer_content_digest_snapshot: string;
      offer_terms_snapshot: unknown;
    }>(
      `update student_verification_tokens
       set used_at=now()
       where id = (
         select id
         from student_verification_tokens
         where token_hash=$1 and used_at is null and expires_at > now()
         order by id
         for update skip locked
         limit 1
       )
       returning user_id,student_email,offer_version_id,offer_key,offer_version_number,
         offer_content_digest_snapshot,offer_terms_snapshot`,
      [hashToken(token)],
    );
    if (!found[0]) return { kind: "invalid" };

    const offer = await pinnedOfferVersion(found[0].offer_version_id, query);
    if (!offer
        || offer.offerKey !== found[0].offer_key
        || offer.versionNumber !== found[0].offer_version_number
        || offer.contentDigest !== found[0].offer_content_digest_snapshot) {
      throw new Error("student_offer_pin_mismatch");
    }

    const claim = await query<{ student_email: string }>(
      `insert into student_claims
         (student_email,user_id,offer_version_id,offer_key,offer_version_number,
          offer_content_digest_snapshot,offer_terms_snapshot)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict do nothing
       returning student_email`,
      [
        found[0].student_email,
        found[0].user_id,
        offer.id,
        offer.offerKey,
        offer.versionNumber,
        offer.contentDigest,
        offer.terms,
      ],
    );
    if (!claim[0]) return { kind: "claimed" };

    const activated = await query<{ premium_until: string; premium_started_at: string }>(
      `update users set
         premium_until=greatest(coalesce(premium_until, now()), now()) + ($3 || ' days')::interval,
         premium_source='student',
         student_email=$2
       where id=$1 and is_banned = false
       returning premium_until,
         (premium_until - ($3 || ' days')::interval) premium_started_at`,
      [found[0].user_id, found[0].student_email, String(offer.terms.grant.days)],
    );
    if (!activated[0]) throw new StudentAccountMissingError("student account missing or banned");

    await query(
      `insert into student_grants
         (student_email,student_email_fingerprint,offer_version_id,offer_key,offer_version_number,
          offer_content_digest_snapshot,offer_terms_snapshot,premium_started_at,premium_until)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        found[0].student_email,
        createHash("sha256").update(found[0].student_email).digest("hex"),
        offer.id,
        offer.offerKey,
        offer.versionNumber,
        offer.contentDigest,
        offer.terms,
        activated[0].premium_started_at,
        activated[0].premium_until,
      ],
    );

    await query(
      `insert into admin_actions (action, target_user_id, target_email, details)
       values ($1,$2,$3,$4)`,
      [
        "student_offer_activated",
        found[0].user_id,
        found[0].student_email,
        JSON.stringify({
          offerKey: offer.offerKey,
          versionNumber: offer.versionNumber,
          contentDigest: offer.contentDigest,
          days: offer.terms.grant.days,
        }),
      ],
    );

    return {
      kind: "activated",
      studentEmail: found[0].student_email,
      premiumUntil: activated[0].premium_until,
      offer: publicOfferSummary(offer),
    };
  });
}

/* ────────────────────────── win-back unsubscribe ────────────────────────── */

// Read through lib/env.ts rather than process.env: env.ts already carries the
// same development fallback and is the thing that refuses to boot in production
// without AUTH_SECRET. Two copies of that literal meant a change to one of them
// would quietly invalidate every unsubscribe link signed by the other.
const UNSUB_SECRET = env.authSecret;

export function unsubSignature(studentEmail: string) {
  return createHmac("sha256", UNSUB_SECRET).update(`student-unsub:${studentEmail}`).digest("base64url");
}

export function unsubUrl(studentEmail: string) {
  return `${env.siteUrl}/api/student/unsubscribe?e=${encodeURIComponent(studentEmail)}&sig=${unsubSignature(studentEmail)}`;
}

/* ────────────────────────── email templates ────────────────────────── */

// CAN-SPAM §7704(a)(5) requires a valid physical postal address in every
// commercial message, and these are commercial: a 20%-off win-back, a student
// upsell, and an expiry notice carrying a purchase CTA. The footer said
// "RoleSharp · <site>" and nothing else.
//
// The address comes from sellerFromEnv() — the same INVOICE_ADDRESS/
// INVOICE_LEGAL_NAME the invoices already print, because a company has one
// legal identity and two sources for it is how they drift apart. Unset in
// development, where the line is simply omitted rather than rendered blank.
export function postalFooter(): string {
  const seller = sellerFromEnv();
  const address = seller.addressLines.join(", ");
  return address ? `${seller.name} · ${address}` : seller.name;
}

const WRAP = (inner: string) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px 24px;border-top:6px solid #2563eb">
    <div style="font-size:14px;font-weight:700;letter-spacing:2px;color:#64748b;margin-bottom:18px">ROLE<span style="color:#2563eb">SHARP</span></div>
    ${inner}
    <p style="color:#64748b;font-size:12px;margin-top:28px">${postalFooter()} · ${env.siteUrl}</p>
  </div>`;

const BTN = (href: string, label: string) =>
  `<p><a href="${href.replace(/"/g, "&quot;")}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${label}</a></p>`;

export async function sendStudentVerifyEmail(
  to: string,
  confirmUrl: string,
  offer: PublicOfferSummary,
) {
  await sendMail({
    to,
    type: "student_verification",
    subject: `Confirm your student email — ${offer.publicSummary}`,
    text: `Confirm your student email to activate ${offer.publicSummary}\n${confirmUrl}\n\nThis link expires in ${offer.tokenTtlHours} hours.`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">Confirm your student email.</h2>
      <p>One click activates <b>${offer.publicSummary}</b> — ${offer.tailoredResumesPerMonth} tailored resumes a month and the included premium features.</p>
      ${BTN(confirmUrl, offer.callToAction)}
      <p style="color:#64748b;font-size:13px">This link expires in ${offer.tokenTtlHours} hours. One claim per student email, ever.</p>`),
  });
}

export async function sendStudentActivatedEmail(to: string, until: Date, offer: PublicOfferSummary) {
  const d = until.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  await sendMail({
    to,
    type: "student_activated",
    subject: `Your ${offer.publicName} is active`,
    text: `Your ${offer.publicName} is active until ${d}. Build at ${env.siteUrl}/build`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">Premium activated.</h2>
      <p>Your student offer is live until <b>${d}</b>. It includes ${offer.tailoredResumesPerMonth} tailored resumes a month and the premium features in your pinned offer.</p>
      ${BTN(`${env.siteUrl}/build`, "Build your first tailored resume")}`),
  });
}

export async function sendStudentWarn30Email(to: string, until: Date) {
  const d = until.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  await sendMail({
    to,
    type: "student_lifecycle",
    subject: "Your student Premium ends in 30 days",
    text: `Your RoleSharp student Premium ends ${d}. Keep Premium from $${env.priceMonthlyCents / 100} (or $${env.priceYearlyCents / 100}/year): ${env.siteUrl}/pricing`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">30 days left on your student Premium.</h2>
      <p>It ends on <b>${d}</b>. After that you drop to the free plan (${tailoredResumes(env.freeMonthlyLimit)}/month, watermarked PDF). Any credits you have earned stay with you. Export anything you want to keep, or continue Premium from $${env.priceMonthlyCents / 100}.</p>
      ${BTN(`${env.siteUrl}/pricing`, "See pricing")}`),
  });
}

export async function sendStudentExpiredEmail(to: string) {
  await sendMail({
    to,
    type: "student_lifecycle",
    subject: "Your student Premium ended today",
    text: `Your RoleSharp student Premium ended today. You're on the free plan now (${env.freeMonthlyLimit}/month, plus any credits you earned). Continue Premium: ${env.siteUrl}/pricing`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">Your student Premium ended today.</h2>
      <p>You're on the free plan now — still ${tailoredResumes(env.freeMonthlyLimit)} a month, the checker, and the manual maker. Any credits you earned came with you. Your saved resumes are untouched.</p>
      ${BTN(`${env.siteUrl}/pricing`, `Continue Premium — $${env.priceMonthlyCents / 100}`)}`),
  });
}

export async function sendStudentWinbackEmail(to: string, studentEmail: string) {
  const monthly = `${env.siteUrl}/api/student/winback?plan=monthly`;
  const yearly = `${env.siteUrl}/api/student/winback?plan=yearly`;
  const unsub = unsubUrl(studentEmail);
  // Quote the same numbers /api/pay/crypto/create will actually charge. These
  // were written out as "$9.60" and "$63.20", so any price change would have
  // put a wrong figure in a customer's inbox and a different one at checkout.
  const winbackMonthly = formatPlanPrice(PLANS.monthly_student20.cents);
  const winbackYearly = formatPlanPrice(PLANS.yearly_student20.cents);
  await sendMail({
    to,
    type: "student_winback",
    subject: "Come back to Premium — 20% off your first period",
    text: `Alumni offer: 20% off your first Premium period.\nMonthly ${winbackMonthly}: ${monthly}\nYearly ${winbackYearly}: ${yearly}\n\nUnsubscribe: ${unsub}`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">20% off — because you were a student with us.</h2>
      <p>Pick up where you left off: your first Premium period at 20% off. <b>${winbackMonthly}</b> for ${env.daysMonthly} days, or <b>${winbackYearly}</b> for ${env.daysYearly}.</p>
      ${BTN(monthly, `Monthly — ${winbackMonthly}`)}
      ${BTN(yearly, `Yearly — ${winbackYearly}`)}
      <p style="color:#64748b;font-size:12px">This is a one-time alumni offer. <a href="${unsub}" style="color:#64748b">Unsubscribe from offer emails</a>.</p>`),
  });
}

export async function sendStudentNudgeEmail(to: string) {
  const offer = await currentStudentOfferSummary();
  // This is an unsolicited commercial message: it is triggered at signup by a
  // heuristic on the address shape, not by anything the recipient asked for, so
  // it needs a working opt-out for the same reason the win-back does. It
  // shipped without one.
  const unsub = unsubUrl(to);
  await sendMail({
    to,
    type: "student_nudge",
    subject: `You signed up with a student email — claim ${offer.publicName}`,
    text: `Your email looks academic. Verify it and claim ${offer.publicSummary}: ${env.siteUrl}/pricing#student\n\nUnsubscribe: ${unsub}`,
    html: WRAP(`
      <h2 style="margin:0 0 10px;font-weight:700">${offer.publicSummary}</h2>
      <p>You signed up with what looks like a student email. Verify it once to receive ${offer.tailoredResumesPerMonth} tailored resumes a month and the included premium features.</p>
      ${BTN(`${env.siteUrl}/pricing#student`, "Claim the student offer")}
      <p style="color:#64748b;font-size:12px"><a href="${unsub}" style="color:#64748b">Unsubscribe from offer emails</a>.</p>`),
  });
}
