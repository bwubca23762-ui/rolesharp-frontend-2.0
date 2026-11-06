import { q } from "./db/core";

// Market demand alarm (Phase 4): when the user's campaign target titles are
// indexed noticeably more this week than last, say so — with the honest
// frame that this is RoleSharp's own job index, not the whole market. The
// decision math is pure and testable; the SQL only fetches two counts.

export type MarketSignal = {
  title: string;
  country: string;
  current: number;
  previous: number;
  multiplier: number;
};

export type CampaignCriteriaLike = { desiredTitles?: unknown; countries?: unknown };

/** Pure decision: rising demand needs a real base and a real jump. */
export function demandDecision(
  current: number,
  previous: number,
): { rising: boolean; multiplier: number } {
  if (current < 5 || previous <= 0 || current <= previous) return { rising: false, multiplier: 0 };
  const multiplier = Math.round((current / previous) * 10) / 10;
  return { rising: multiplier >= 1.5, multiplier };
}

export async function marketDemandSignal(userId: string): Promise<MarketSignal | null> {
  let campaign: { criteria: CampaignCriteriaLike } | undefined;
  try {
    const rows = await q<{ criteria: CampaignCriteriaLike }>(
      `select criteria from job_campaigns
       where user_id=$1 and mode='daily_matches'
       order by created_at desc limit 1`,
      [userId],
    );
    campaign = rows[0];
  } catch {
    return null; // no campaigns table access (local dev / outage) — no alarm
  }
  if (!campaign) return null;

  const titles = Array.isArray(campaign.criteria?.desiredTitles)
    ? (campaign.criteria.desiredTitles as unknown[]).filter((t): t is string => typeof t === "string" && t.trim().length > 2)
    : [];
  const countries = Array.isArray(campaign.criteria?.countries)
    ? (campaign.criteria.countries as unknown[]).filter((c): c is string => typeof c === "string" && /^[a-z]{2}$/i.test(c))
    : [];
  const title = titles[0]?.trim();
  const country = countries[0]?.toLowerCase();
  if (!title || !country) return null;

  const like = `%${title.replace(/[%_]/g, "")}%`;
  let current = 0;
  let previous = 0;
  try {
    const rows = await q<{ current: number; previous: number }>(
      `select
         count(*) filter (where date_posted >= now() - interval '7 days')::int as current,
         count(*) filter (where date_posted >= now() - interval '14 days' and date_posted < now() - interval '7 days')::int as previous
       from jobs
       where country_code=$1 and title ilike $2 and expires_at > now()`,
      [country, like],
    );
    current = Number(rows[0]?.current ?? 0);
    previous = Number(rows[0]?.previous ?? 0);
  } catch {
    return null;
  }

  const decision = demandDecision(current, previous);
  if (!decision.rising) return null;
  return { title, country: country.toUpperCase(), current, previous, multiplier: decision.multiplier };
}
