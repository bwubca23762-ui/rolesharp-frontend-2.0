import { q } from "./db/core";
import { terms } from "./ats-score";
import type { PublicProfile } from "./personal-site";

// Talent marketplace (Phase 4): an anonymized listing of people who chose
// in. Strict by construction — anonymizeForTalentMarketplace() rebuilds the
// object field-by-field, the same defense publicProfile() uses for contact
// data, so a field added to the profile shape later stays hidden by default
// instead of leaking. Recruiters never see identity: they send an intro
// request, and the site owner decides whether to respond.

export type TalentCard = {
  siteId: string;
  /** Role headline only — "Senior Product Designer". No name, no contact. */
  headline: string;
  /** Region at country granularity; city-level would narrow too far. */
  region: string | null;
  yearsExperience: number;
  topSkills: string[];
  caseStudyCount: number;
  verifiedAtsScore: number | null;
  updatedAt: string;
};

export type TalentIntroInput = { contact: string; company: string; message: string };

const MAX_SKILLS = 8;
const MIN_HEADLINE = 3;

/** Years of experience from dated roles only — no guessing from vibes. */
function yearsFromProfile(profile: PublicProfile): number {
  const years = profile.experiences
    .map((experience) => {
      const match = experience.period?.match(/(\d{4})\s*(?:—|–|-)\s*(\d{4}|present)/i);
      if (!match) return 0;
      const start = Number(match[1]);
      const end = match[2].toLowerCase() === "present" ? new Date().getFullYear() : Number(match[2]);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0;
    })
    .filter((years) => years > 0);
  return years.length > 0 ? Math.max(...years) : 0;
}

function regionFromProfile(profile: PublicProfile): string | null {
  const location = profile.contact?.location?.trim();
  if (!location) return null;
  // Keep the last comma segment at country-ish granularity when the owner
  // chose to show contact at all; strict mode drops it entirely otherwise.
  const parts = location.split(",").map((part) => part.trim());
  return parts[parts.length - 1] ?? null;
}

export function anonymizeForTalentMarketplace(
  siteId: string,
  profile: PublicProfile,
  opts: { verifiedAtsScore?: number | null; updatedAt?: string } = {},
): TalentCard | null {
  const headline = profile.headline?.trim() ?? "";
  if (headline.length < MIN_HEADLINE) return null;
  const skills = profile.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, MAX_SKILLS);
  return {
    siteId,
    headline,
    region: regionFromProfile(profile),
    yearsExperience: yearsFromProfile(profile),
    topSkills: skills,
    caseStudyCount: profile.caseStudies.length,
    verifiedAtsScore: opts.verifiedAtsScore ?? null,
    updatedAt: opts.updatedAt ?? new Date().toISOString(),
  };
}

/** Contact validation: an email or a LinkedIn handle — enough to reply, no form spam. */
export function cleanIntroRequest(input: unknown): { contact: string; company: string; message: string } | null {
  const raw = (input ?? {}) as Partial<Record<"contact" | "company" | "message", unknown>>;
  const contact = typeof raw.contact === "string" ? raw.contact.trim().slice(0, 200) : "";
  const company = typeof raw.company === "string" ? raw.company.trim().slice(0, 120) : "";
  const message = typeof raw.message === "string" ? raw.message.trim().slice(0, 1_000) : "";
  const contactOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^linkedin\.com\/in\/[\w-]{3,}$/i.test(contact);
  if (!contactOk || company.length < 2 || message.length < 10) return null;
  return { contact, company, message };
}

export type TalentListingRow = {
  id: string;
  ats_score: number | null;
  verified_ats_score: number | null;
  updated_at: Date | string;
  content: unknown;
};

// Opt-in is the gate: published alone is not enough. indexable stays
// irrelevant here — a person can be listed anonymized while keeping their
// page out of search.
export async function optedInTalentRows(limit = 200): Promise<TalentListingRow[]> {
  return q<TalentListingRow>(
    `select s.id, s.case_studies, s.verified_ats_score, s.updated_at, r.ats_score, r.content
     from personal_sites s
     join resumes r on r.id = s.resume_id
     where s.published_at is not null
       and s.talent_marketplace_opt_in
     order by s.updated_at desc
     limit $1`,
    [limit],
  );
}

export async function recordTalentIntroRequest(siteId: string, input: { contact: string; company: string; message: string }): Promise<boolean> {
  const rows = await q<{ id: string }>(
    `insert into talent_intro_requests (personal_site_id, requester_contact, requester_company, message)
     select id, $2, $3, $4 from personal_sites
     where id = $1 and published_at is not null and talent_marketplace_opt_in
     returning id`,
    [siteId, input.contact, input.company, input.message],
  );
  return rows.length > 0;
}

export async function talentIntroCountForOwner(userId: string): Promise<number> {
  const rows = await q<{ n: number }>(
    `select count(*)::int as n
     from talent_intro_requests t
     join personal_sites s on s.id = t.personal_site_id
     where s.user_id = $1 and t.status = 'pending'`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

// Keyword sanity for the listing page: headline + skills must be non-empty
// enough to be searchable by recruiters. Reuses the shared `terms` tokenizer
// so what the search surfaces matches what the resume surfaces.
export function talentCardSearchable(card: TalentCard): boolean {
  return terms(card.headline).length > 0 || card.topSkills.length > 0;
}
