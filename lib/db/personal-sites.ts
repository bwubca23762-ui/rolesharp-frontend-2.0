import { q } from "./core";

import type { CaseStudyItem, PortfolioItem } from "../personal-site";

export type PersonalSiteRow = {
  handle: string;
  resume_id: string;
  display_name: string;
  show_contact: boolean;
  indexable: boolean;
  talent_opt_in: boolean;
  portfolio: PortfolioItem[];
  case_studies: CaseStudyItem[];
  published_at: string | null;
};

export type PublishedSite = PersonalSiteRow & { content: unknown };

/**
 * The public lookup. `published_at is not null` is in the WHERE, not checked
 * after the fetch: an unpublished site must select no row at all, the same way
 * the invoice route puts the owner in the WHERE.
 */
export async function publishedSiteByHandle(handle: string): Promise<PublishedSite | null> {
  const rows = await q<PublishedSite>(
    `select s.handle, s.resume_id, s.display_name, s.show_contact, s.indexable, s.talent_marketplace_opt_in as "talent_opt_in", s.portfolio, s.case_studies, s.published_at,
            r.content
     from personal_sites s
     join resumes r on r.id = s.resume_id
     where s.handle = $1 and s.published_at is not null
     limit 1`,
    [handle],
  );
  return rows[0] ?? null;
}

export async function siteForUser(userId: string): Promise<PersonalSiteRow | null> {
  const rows = await q<PersonalSiteRow>(
    `select handle, resume_id, display_name, show_contact, indexable, talent_marketplace_opt_in as "talent_opt_in", portfolio, case_studies, published_at
     from personal_sites where user_id = $1 limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * One site per user, so this upserts on user_id. The resume is joined on
 * ownership in the same statement — passing somebody else's resume id must
 * select nothing rather than publish their history under your handle.
 */
export async function saveSite(
  userId: string,
  site: { handle: string; resumeId: string; displayName: string; showContact: boolean; indexable: boolean; talentOptIn: boolean; portfolio: PortfolioItem[]; caseStudies: CaseStudyItem[]; published: boolean },
): Promise<PersonalSiteRow | null> {
  const rows = await q<PersonalSiteRow>(
    `insert into personal_sites (user_id, handle, resume_id, display_name, show_contact, indexable, talent_marketplace_opt_in, portfolio, case_studies, published_at)
     select $1, $2, r.id, $4, $5, $6, $7, $9::jsonb, $10::jsonb, case when $8 then now() else null end
       from resumes r where r.id = $3 and r.user_id_text = $1
     on conflict (user_id) do update
       set handle = excluded.handle,
           resume_id = excluded.resume_id,
           display_name = excluded.display_name,
           show_contact = excluded.show_contact,
           indexable = excluded.indexable,
           talent_marketplace_opt_in = excluded.talent_marketplace_opt_in,
           portfolio = excluded.portfolio,
           case_studies = excluded.case_studies,
           -- Republishing keeps the original publication time; unpublishing
           -- clears it. The owner toggling a setting must not silently
           -- re-date when they went public.
           published_at = case when $7 then coalesce(personal_sites.published_at, now()) else null end,
           updated_at = now()
     returning handle, resume_id, display_name, show_contact, indexable, talent_marketplace_opt_in as "talent_opt_in", portfolio, case_studies, published_at`,
    [userId, site.handle, site.resumeId, site.displayName, site.showContact, site.indexable, site.talentOptIn, site.published, JSON.stringify(site.portfolio), JSON.stringify(site.caseStudies)],
  );
  return rows[0] ?? null;
}

/** Whether a handle is taken by somebody else. */
export async function handleTaken(handle: string, userId: string): Promise<boolean> {
  const rows = await q<{ one: number }>(
    `select 1 as one from personal_sites where handle = $1 and user_id <> $2 limit 1`,
    [handle, userId],
  );
  return rows.length > 0;
}

/**
 * The public directory and the sitemap.
 *
 * `indexable` is in the WHERE alongside `published_at`. A site that is
 * published but not indexable is reachable by link and must never appear in a
 * list a crawler can walk — that is the entire difference between the two
 * switches, and this is the query where getting it wrong would publish someone
 * who chose not to be findable.
 */
export async function indexableSites(limit = 500) {
  return q<{ handle: string; display_name: string; headline: string | null; published_at: string }>(
    `select s.handle, s.display_name, r.content->>'headline' as headline, s.published_at
     from personal_sites s
     join resumes r on r.id = s.resume_id
     where s.published_at is not null and s.indexable
     order by s.published_at desc
     limit $1`,
    [limit],
  );
}
