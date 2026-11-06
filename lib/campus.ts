import { q } from "./db/core";

// Campus portals (Phase 4): a cohort page per university. Membership is
// DERIVED — a user belongs to the cohort whose email_domain matches their
// account email — so no member table exists to leak. Placement aggregates
// are k-anonymized: a cohort with fewer than five members reports nothing,
// per the migration's own rule. The numbers describe the cohort's own
// tracker stages (self-reported workflow), never employer outcomes.

export const CAMPUS_K_ANONYMITY = 5;

export type CampusPortal = { slug: string; universityName: string; emailDomain: string };

export async function campusPortalBySlug(slug: string): Promise<CampusPortal | null> {
  const rows = await q<CampusPortal>(
    `select slug, university_name as "universityName", email_domain as "emailDomain"
     from campus_portals where slug=$1 limit 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export type CampusAggregate = {
  members: number;
  totalApplications: number;
  byStatus: { status: string; count: number }[];
  /** Members who moved at least one application past saved. */
  activeMembers: number;
};

// Aggregates over the cohort's OWN application records, keyed by the derived
// email-domain membership. K-anonymity gates the whole payload: below five
// members, return null rather than a near-identifying slice.
export async function campusCohortAggregate(portal: CampusPortal): Promise<CampusAggregate | null> {
  const domain = portal.emailDomain.toLowerCase().replace(/^@/, "");
  const rows = await q<{ members: number; total: number; active: number }>(
    `select
       count(distinct u.id)::int as members,
       count(a.id)::int as total,
       count(distinct a.user_id_text)::int as active
     from users u
     left join applications a on a.user_id_text = u.id::text
     where lower(split_part(u.email, '@', 2)) = $1
       and u.deleting_at is null`,
    [domain],
  );
  const base = rows[0];
  if (!base || Number(base.members) < CAMPUS_K_ANONYMITY) return null;

  const statusRows = await q<{ status: string; count: number }>(
    `select a.status, count(*)::int as count
     from applications a
     join users u on u.id::text = a.user_id_text
     where lower(split_part(u.email, '@', 2)) = $1
       and u.deleting_at is null
     group by a.status order by count desc`,
    [domain],
  );

  return {
    members: Number(base.members),
    totalApplications: Number(base.total),
    activeMembers: Number(base.active),
    byStatus: statusRows.map((row) => ({ status: row.status, count: Number(row.count) })),
  };
}

export function campusEmailMatches(userEmail: string | null | undefined, portal: CampusPortal): boolean {
  if (!userEmail) return false;
  const domain = portal.emailDomain.toLowerCase().replace(/^@/, "");
  return userEmail.toLowerCase().endsWith(`@${domain}`);
}
