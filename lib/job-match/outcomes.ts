import { q } from "../db";

// Phase 3: outcome-calibrated matching. The calibration harness
// (scripts/job-match-calibration.ts) scores ranking quality against synthetic
// outcomes; this module feeds it the real thing. Impressions are job_matches
// rows (what a campaign actually presented); outcomes are what the candidate
// did next, derived with an honest precedence from data RoleSharp already
// owns — tracker statuses and package approvals. Nothing here invents a
// signal: a match with no tracker row and no approval is an impression
// without an outcome, and stays exactly that.

export type OutcomeCandidateRow = {
  user_id: string;
  campaign_id: string;
  canonical_job_key: string;
  fit_score: number | null;
  confidence_score: number | null;
  blockers: unknown;
  status: string;
  ranked_at: string | null;
  score_version: number;
  tracker_status: string | null;
  tracker_updated_at: string | null;
  approval_status: string | null;
  approval_at: string | null;
};

export type DerivedOutcome = {
  type: "saved" | "manual_applied" | "approved_email" | "interview";
  at: string;
  id: string;
};

export type CalibrationRow = {
  userId: string;
  canonicalJobKey: string;
  rank: number;
  impressionAt: string;
  fit: number;
  confidence: number;
  blocked: boolean;
  eligible: boolean;
  outcome?: DerivedOutcome;
  versionsAt: { profile: string; job: string; score: string; features: string };
};

export async function loadOutcomeCandidates(limit = 50_000): Promise<OutcomeCandidateRow[]> {
  return q<OutcomeCandidateRow>(
    `select m.user_id, m.campaign_id, m.canonical_job_key, m.fit_score, m.confidence_score,
            m.blockers, m.status, m.ranked_at, m.score_version,
            a.status as tracker_status, a.updated_at as tracker_updated_at,
            pa.status as approval_status, pa.approved_at as approval_at
     from job_matches m
     left join applications a
       on a.user_id = m.user_id and a.canonical_job_key = m.canonical_job_key
     left join lateral (
       select pa.status, pa.approved_at
       from application_packages p
       join package_approvals pa on pa.package_id = p.id
       where p.user_id = m.user_id and p.canonical_job_key = m.canonical_job_key
       order by pa.approved_at desc nulls last
       limit 1
     ) pa on true
     where m.ranked_at is not null
     order by m.ranked_at desc
     limit $1`,
    [limit],
  );
}

// Precedence follows the harness's own label order (interview 4 >
// approved_email 3 = manual_applied 3 > saved 2): the strongest honest signal
// a candidate left wins, approvals before tracker-applied on the label tie.
// "opened"/"dismissed" are intentionally absent — we do not track digest
// opens per match, and inferring a dismissal from silence would be
// fabrication.
export function deriveOutcome(row: OutcomeCandidateRow): DerivedOutcome | undefined {
  if (row.tracker_status === "interview" || row.tracker_status === "offer") {
    return { type: "interview", at: row.tracker_updated_at ?? row.ranked_at!, id: `tracker:${row.canonical_job_key}` };
  }
  if (row.approval_status === "active" || row.approval_status === "consumed") {
    return { type: "approved_email", at: row.approval_at ?? row.ranked_at!, id: `approval:${row.canonical_job_key}` };
  }
  if (row.tracker_status === "applied") {
    return { type: "manual_applied", at: row.tracker_updated_at ?? row.ranked_at!, id: `tracker:${row.canonical_job_key}` };
  }
  if (row.tracker_status === "saved") {
    return { type: "saved", at: row.tracker_updated_at ?? row.ranked_at!, id: `tracker:${row.canonical_job_key}` };
  }
  return undefined;
}

function isBlocked(row: OutcomeCandidateRow): boolean {
  if (row.status !== "eligible") return true;
  return Array.isArray(row.blockers) && row.blockers.length > 0;
}

/**
 * Shape real rows into the calibration harness's Row contract. Rank is
 * derived, and labelled as derived: within a user+campaign run, matches were
 * presented best-first, so rank is the fit_score order of that run — the same
 * ordering the digest used. Rows missing a score are dropped (they were never
 * really presented).
 */
export function toCalibrationRows(candidates: readonly OutcomeCandidateRow[]): CalibrationRow[] {
  const presentable = candidates.filter((row) =>
    row.ranked_at != null && row.fit_score != null && row.confidence_score != null);
  const ranks = new Map<string, number>();
  const runs = new Map<string, OutcomeCandidateRow[]>();
  for (const row of presentable) {
    const runKey = `${row.user_id}\0${row.campaign_id}`;
    runs.set(runKey, [...(runs.get(runKey) ?? []), row]);
  }
  for (const run of runs.values()) {
    const ordered = [...run].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    ordered.forEach((row, index) => ranks.set(`${row.user_id}\0${row.canonical_job_key}\0${row.campaign_id}`, index + 1));
  }
  return presentable.map((row) => {
    const impression = new Date(row.ranked_at!);
    const versionTime = new Date(impression.getTime() - 86400_000).toISOString();
    const outcome = deriveOutcome(row);
    return {
      userId: row.user_id,
      canonicalJobKey: row.canonical_job_key,
      rank: ranks.get(`${row.user_id}\0${row.canonical_job_key}\0${row.campaign_id}`) ?? 1,
      impressionAt: impression.toISOString(),
      fit: row.fit_score!,
      confidence: row.confidence_score!,
      blocked: isBlocked(row),
      eligible: row.status === "eligible",
      ...(outcome ? { outcome } : {}),
      versionsAt: { profile: versionTime, job: versionTime, score: versionTime, features: versionTime },
    };
  });
}
