import { q } from "./db";

/**
 * Machine-readable export of everything an account owns.
 *
 * The seeded privacy policy tells users they may request "access, correction,
 * deletion, restriction, portability, or objection" and that product controls
 * support exports (047_legal_document_versions.sql). Deletion existed;
 * portability did not — there was no export route anywhere in the app, so the
 * only honest way to satisfy a request was by hand.
 *
 * Columns are listed explicitly rather than `select *`. That is not style: the
 * users row carries `password_hash` and `auth_version`, student rows carry
 * verification tokens, and mail connections carry encrypted refresh
 * credentials. A `select *` here would put all of it in a file the user
 * downloads over the public internet, and the next migration to add a secret
 * column would silently join it.
 *
 * Everything is scoped by the caller's own id. Nothing takes an id parameter
 * from the request, so there is no object to make a reference to.
 */
export type AccountExport = Record<string, unknown>;

export async function buildAccountExport(userId: string, email: string): Promise<AccountExport> {
  const [
    account,
    resumes,
    applications,
    supportTickets,
    supportMessages,
    creditEvents,
    payments,
    communicationPreferences,
    notificationPreferences,
    studentClaim,
    personalSites,
    jobAlerts,
    toolRuns,
    jobPreferences,
    socialRewardClaims,
    promoRedemptions,
    legalAcceptances,
  ] = await Promise.all([
    q(`select id, email, created_at, email_verified_at, premium_until, premium_source, credits, invite_code, referred_by
       from users where id=$1`, [userId]),
    q(`select id, candidate_name, ats_score, template, premium_unlock, created_at, content, jd_text
       from resumes where user_id_text=$1 or user_id=$1::uuid order by created_at desc`, [userId]),
    q(`select id, company, role, status, job_url, notes, resume_id, follow_up_at, created_at, updated_at
       from applications where user_id_text=$1 order by created_at desc`, [userId]),
    q(`select id, email, name, subject, status, created_at, updated_at
       from support_tickets where user_id_text=$1 order by created_at desc`, [userId]),
    // Ticket threads belong to the data subject — the body they wrote and the
    // reply they received. Scoped through the user's own tickets.
    q(`select m.id, m.ticket_id, m.author, m.body, m.created_at
       from support_messages m
       join support_tickets t on t.id = m.ticket_id
       where t.user_id_text=$1 order by m.created_at desc`, [userId]),
    q(`select id, kind, delta, resume_id, details, created_at
       from credit_events where user_id=$1 order by created_at desc`, [userId]),
    // Payment records, minus the provider order reference: it encodes the user
    // id and is an operational key, not something the customer needs back.
    q(`select id, status, pay_currency, price_amount, created_at, updated_at
       from crypto_payments where user_id_text=$1 order by created_at desc`, [userId]),
    q(`select product_updates_enabled, career_tips_enabled, source, updated_at
       from communication_preferences where user_id=$1`, [userId]),
    q(`select product_updates_enabled, career_tips_enabled, updated_at
       from notification_preferences where user_id=$1`, [userId]),
    // The academic address is retained deliberately after deletion for
    // lifetime offer-abuse prevention, and that retention is disclosed — so it
    // belongs in an access request too.
    q(`select student_email, claimed_at, winback_opt_out from student_claims where user_id=$1`, [userId]),
    q(`select id, handle, resume_id, display_name, show_contact, indexable, portfolio, published_at, created_at
       from personal_sites where user_id=$1 order by created_at desc`, [userId]),
    // unsubscribe_token stays out: it is a live capability credential — the
    // export file must not double as a session into mail settings.
    q(`select id, role_keyword, country_code, frequency, paused, last_sent_at, created_at, updated_at
       from job_alerts where user_id=$1 order by created_at desc`, [userId]),
    q(`select id, tool, score, summary, created_at
       from tool_runs where user_id=$1 order by created_at desc`, [userId]),
    q(`select min_salary, currency, remote_only, languages, location_scope, home_country, target_countries, created_at, updated_at
       from user_job_preferences where user_id=$1`, [userId]),
    // handle is the self-attested public identifier the user typed — theirs
    // to see. ip_address is an operational anti-fraud record; retention is
    // disclosed, but it is not part of the portable profile, so it stays out.
    q(`select id, platform, handle, credits_awarded, requested_credits, review_status, review_note, reviewed_at, follow_attested_at, created_at
       from social_reward_claims where user_id=$1 order by created_at desc`, [userId]),
    q(`select id, code, order_id, discount_cents, created_at
       from promo_redemptions where user_id=$1 order by created_at desc`, [userId]),
    // Digests, not documents: the acceptance PROOF (which version, evidence
    // digest), not a re-download of the legal text itself.
    q(`select id, document_key, version_number, content_digest_snapshot, acceptance_surface, accepted_at
       from legal_acceptances where user_id=$1 order by accepted_at desc`, [userId]),
  ]);

  return {
    exportFormat: "rolesharp.account-export.v2",
    // Stamped by the caller, not here: the value has to match the filename the
    // response is served under.
    account: account[0] ?? { id: userId, email },
    resumes,
    applications,
    supportTickets,
    supportMessages,
    creditEvents,
    payments,
    communicationPreferences: communicationPreferences[0] ?? null,
    notificationPreferences: notificationPreferences[0] ?? null,
    studentClaim: studentClaim[0] ?? null,
    personalSites,
    jobAlerts,
    toolRuns,
    jobPreferences: jobPreferences[0] ?? null,
    socialRewardClaims,
    promoRedemptions,
    legalAcceptances,
  };
}
