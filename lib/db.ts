import { allCuratedRoleSlugs, hasIndexableRoleEvidence, roleSlugsForSector } from "./seo-roles";
import { q, withTransaction } from "./db/core";
export { hasDb, q, withTransaction } from "./db/core";
export type { TransactionQuery } from "./db/core";
export { getCompanyBySlug, matchCompanyByText, searchCompanies } from "./db/companies";
export { getRoleBySlug, listRoles, listRolesWithSkills, matchRoleByText, searchRoles } from "./db/roles";
export {
  APP_STATUSES,
  ApplicationDomainError,
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
  variantOutcomes,
} from "./db/applications";
export type { ApplicationErrorCode, AppStatus, VariantOutcomeAggregate } from "./db/applications";
export {
  addTicketMessage,
  countOpenTickets,
  createTicket,
  getTicket,
  listAllTickets,
  listUserTickets,
  setTicketStatus,
} from "./db/support";
export type { TicketStatus } from "./db/support";
export {
  deleteResumeAsAdmin,
  deleteUserResume,
  duplicateUserResume,
  getFailedGeneration,
  getResume,
  getUserResume,
  listUserResumes,
  markPaid,
  renameUserResume,
  saveResume,
} from "./db/resumes";

export async function deleteUserAccountData(
  userId: string,
  audit?: { action: string; targetEmail: string | null; details: Record<string, unknown> },
): Promise<boolean> {
  return withTransaction(async (query) => {
    // Serialize deletion against worker persistence. saveResume() takes a
    // KEY SHARE lock on this same row before writing, so either the resume is
    // deleted below or the worker observes that the account no longer exists.
    const owner = await query<{ id: string }>(
      "select id from users where id=$1 for update",
      [userId],
    );
    if (!owner[0]) return false;
    // Keep lifetime student-offer abuse prevention while removing the direct
    // account identifier. Retention of the academic email is disclosed.
    await query("update student_claims set user_id=null where user_id=$1", [userId]);
    // student_grants intentionally contains no account identifier. Its academic
    // email fingerprint and immutable offer snapshot remain as the grant receipt.
    await query("update users set referred_by=null where referred_by=$1", [userId]);
    await query("delete from generation_reservations where user_id=$1", [userId]);
    await query("delete from student_verification_tokens where user_id=$1", [userId]);
    // In-app notification and communication preferences are private account data.
    await query("delete from notification_user_states where user_id=$1", [userId]);
    await query("delete from notification_preferences where user_id=$1", [userId]);
    await query("delete from communication_preferences where user_id=$1", [userId]);
    await query("delete from support_tickets where user_id_text=$1", [userId]);
    await query("delete from applications where user_id_text=$1", [userId]);
    await query("delete from resumes where user_id_text=$1", [userId]);
    // Payments received are an accounting record, which the privacy policy
    // already reserves ("narrowly justified legal, security, fraud, or
    // accounting retention"). Keep the row, strip the identifiers: order_id
    // embeds the user id (`${plan}_${userId}_${uuid}`, lib/crypto-payments.ts),
    // so nulling user_id_text alone would leave the account trivially
    // re-identifiable and the erasure would be cosmetic.
    await query(
      `update crypto_payments
       set order_id = replace(order_id, user_id_text, 'deleted'), user_id_text = null
       where user_id_text=$1`,
      [userId],
    );
    // Quarantined callback bodies carry payout addresses and are keyed by the
    // same user-encoding order_id. With the account gone they can never be
    // replayed into a grant, so they are pure retained payment PII.
    await query("delete from ipn_quarantine where order_id like $1", [`%\\_${userId}\\_%`]);
    // email_log has no user column, so nothing here could ever reach it and the
    // address outlived the account it belonged to. Match on the address itself.
    await query("delete from email_log where recipient = (select lower(email) from users where id=$1)", [userId]);
    const deleted = await query<{ id: string }>("delete from users where id=$1 returning id", [userId]);
    if (!deleted[0]) return false;
    if (audit) {
      await query(
        `insert into admin_actions (action, target_user_id, target_email, details)
         values ($1,$2,$3,$4)`,
        [audit.action, userId, audit.targetEmail, JSON.stringify(audit.details)],
      );
    }
    return true;
  });
}

// Volume discipline: Search Console showed that Google was discovering the
// programmatic surface much faster than it could crawl it. Keep the submitted
// inventory to 400 well-described employers (website + sector), split into two
// stable chunks. Routes outside this curated set can remain useful when reached
// directly, but they do not consume sitemap or hub crawl budget.
export const SEO_ROLES_PER = 50;
export const SEO_COMPANIES_PER = 400;

// Role slugs that participate in the indexable programmatic surface — curated
// roles with maintained skills and at least one illustrative bullet pattern.
export async function seoRoleSlugs() {
  const curated = allCuratedRoleSlugs();
  const rows = await q<{ slug: string }>(
    `select slug from roles
     where slug = any($1)
       and cardinality(required_skills) >= 3
       and cardinality(typical_bullets) >= 1`,
    [curated],
  );
  const present = new Set(rows.map((r) => r.slug));
  return curated.filter((s) => present.has(s));
}

// ---- SEO hub pages (internal-linking authority) ----
export async function listSeoCompanies(limit = SEO_COMPANIES_PER) {
  // hiring_listings: live postings seen in the last 30 days whose `company`
  // text matches the employer's name (case-insensitive). One aggregate scan
  // of `jobs`, hash-joined — never a per-company subquery. It is a signal
  // from our own ingestion, labeled as listings-seen on the page; it is not
  // a claim about the employer's private hiring bar.
  return q<{ slug: string; name: string; country_code: string | null; sector: string | null; hiring_listings: number }>(
    `with hiring as (
       select lower(company) as hk, count(*)::int as n
       from jobs
       where expires_at > now() and last_seen_at > now() - interval '30 days'
       group by lower(company)
     )
     select c.slug, c.name, c.country_code, c.sector, coalesce(h.n, 0) as hiring_listings
     from companies c
     left join hiring h on h.hk = lower(c.name)
     where c.website is not null and c.sector is not null
     order by c.tier, (c.website is null), (c.sector is null), c.country_code, c.id
     limit $1`,
    [limit],
  );
}

// Keep every crawlable company surface aligned with the same bounded set used
// by the sitemap and company/role cross-links. A valid catalog row outside this
// set can still be reached directly, but it must not silently become another
// indexable landing page just because its detail route exists.
export async function isSeoCompanySlug(slug: string) {
  const rows = await q<{ eligible: boolean }>(
    `select exists (
       select 1
       from (
         select slug
         from companies
         where website is not null and sector is not null
         order by tier, (website is null), (sector is null), country_code, id
         limit $1
       ) curated
       where curated.slug = $2
     ) as eligible`,
    [SEO_COMPANIES_PER, slug],
  );
  return rows[0]?.eligible === true;
}

export async function listSeoCompaniesByCountry(countryCode: string, limit = SEO_COMPANIES_PER) {
  return q<{ slug: string; name: string; sector: string | null; tier: string }>(
    `with curated as (
       select slug, name, sector, tier, country_code
       from companies
       where website is not null and sector is not null
       order by tier, (website is null), (sector is null), country_code, id
       limit $1
     )
     select slug, name, sector, tier
     from curated
     where lower(country_code) = lower($2)
     order by tier, name
     limit $3`,
    [SEO_COMPANIES_PER, countryCode, limit],
  );
}

export async function seoRoleList(limit = SEO_ROLES_PER) {
  // Keep public guide directories aligned with curated roles that carry the
  // maintained evidence required by indexable role and company×role pages.
  const curated = allCuratedRoleSlugs();
  return q<{ slug: string; title: string; sector: string | null }>(
    `select slug, title, sector from roles
     where slug = any($2)
       and cardinality(required_skills) >= 3
       and cardinality(typical_bullets) >= 1
     order by (source='manual') desc, title
     limit $1`,
    [limit, curated],
  );
}

// Companies (other than `excludeSlug`) whose sector supports `roleSlug` —
// used for the "same role at other companies" internal links so every link
// targets a live, indexable page instead of a hardcoded FAANG list.
export async function companiesForRole(roleSlug: string, excludeSlug: string, limit = 12) {
  const eligibleRole = await q<{ slug: string }>(
    `select slug from roles
     where slug = $1
       and cardinality(required_skills) >= 3
       and cardinality(typical_bullets) >= 1
     limit 1`,
    [roleSlug],
  );
  if (!eligibleRole.length || !allCuratedRoleSlugs().includes(roleSlug)) return [];
  const companies = await q<{ slug: string; name: string; sector: string | null }>(
    `select slug, name, sector from companies
     where website is not null and sector is not null
     order by tier, (website is null), (sector is null), country_code, id
     limit $1`,
    [SEO_COMPANIES_PER],
  );
  return companies
    .filter((c) => c.slug !== excludeSlug && roleSlugsForSector(c.sector).includes(roleSlug))
    .slice(0, limit);
}

// Roles a specific company hub/page may publish: the sector-curated slugs that
// exist in the DB, with titles for rendering.
export async function rolesForCompanySector(sector: string | null | undefined) {
  const slugs = roleSlugsForSector(sector);
  const rows = await q<{
    slug: string;
    title: string;
    sector: string | null;
    required_skills: string[];
    typical_bullets: string[];
  }>(
    `select slug, title, sector, required_skills, typical_bullets
     from roles
     where slug = any($1)
       and cardinality(required_skills) >= 3
       and cardinality(typical_bullets) >= 1`,
    [slugs],
  );
  const order = new Map(slugs.map((s, i) => [s, i]));
  return rows
    .filter(hasIndexableRoleEvidence)
    .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
}

// Slugs for the curated hub pages that go in the sitemap.
export async function listSeoHubs() {
  const [companies, roles] = await Promise.all([listSeoCompanies(), seoRoleSlugs()]);
  return { companies: companies.map((c) => c.slug), roles };
}
