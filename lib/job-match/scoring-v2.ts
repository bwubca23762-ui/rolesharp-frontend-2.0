import type { HardBlocker, ScoredMatch, SignalScore } from "./types";
import type { JobPreferences } from "../job-preferences";

// Fit rubric v2 (Phase 2 of the job-match upgrade). Two additions over the
// deterministic v1 engine, both grounded in declared data only:
//
// 1. Named rubric dimensions — v1 already scores five weighted signals; v2
//    surfaces them as the five rubric dimensions (skills, seniority,
//    location, compensation, trajectory) with their evidence, so a match
//    score is explainable per dimension instead of one opaque number.
// 2. Deal-breaker vetoes — a posting that violates a declared preference
//    (lib/job-preferences.ts) is blocked outright no matter how well it
//    scores. Vetoes reuse the existing HardBlocker kinds so every downstream
//    consumer (job_matches.status, digests, review queue) treats them exactly
//    like the engine's own hard rules.

export type RubricDimension = {
  readonly id: "skills" | "seniority" | "location" | "compensation" | "trajectory";
  readonly label: string;
  readonly weightBasisPoints: number;
  readonly scoreBasisPoints: number;
  readonly evidence: string;
};

// v1 scores ten fine-grained signals; the rubric groups them into the five
// dimensions a candidate actually reasons about. Each dimension's score is
// the weight-averaged match of its member signals, and its evidence is the
// weakest member's explanation — a dimension is only as strong as its
// weakest signal, and that is the one worth reading.
const SIGNAL_DIMENSION: Record<string, RubricDimension["id"]> = {
  required_skills: "skills",
  preferred_skills: "skills",
  title: "seniority",
  seniority: "seniority",
  experience: "seniority",
  location_remote: "location",
  work_type: "location",
  authorization: "location",
  compensation: "compensation",
  freshness: "trajectory",
};

const DIMENSION_LABELS: Record<RubricDimension["id"], string> = {
  skills: "Skills",
  seniority: "Seniority",
  location: "Location & work type",
  compensation: "Compensation",
  trajectory: "Trajectory & freshness",
};

const DIMENSION_ORDER: readonly RubricDimension["id"][] = ["skills", "seniority", "location", "compensation", "trajectory"];

export function rubricDimensions(signals: readonly SignalScore[]): readonly RubricDimension[] {
  const groups = new Map<RubricDimension["id"], { weight: number; weighted: number; weakest: SignalScore | null }>();
  for (const signal of signals) {
    const id = SIGNAL_DIMENSION[signal.signal] ?? "trajectory";
    const group = groups.get(id) ?? { weight: 0, weighted: 0, weakest: null };
    group.weight += signal.weightBasisPoints;
    group.weighted += signal.matchBasisPoints * signal.weightBasisPoints;
    if (!group.weakest || signal.matchBasisPoints < group.weakest.matchBasisPoints) group.weakest = signal;
    groups.set(id, group);
  }
  return DIMENSION_ORDER
    .filter((id) => groups.has(id))
    .map((id) => {
      const group = groups.get(id)!;
      return {
        id,
        label: DIMENSION_LABELS[id],
        weightBasisPoints: group.weight,
        scoreBasisPoints: group.weight > 0 ? Math.round(group.weighted / group.weight) : 0,
        evidence: group.weakest?.explanation ?? "",
      };
    });
}

type VetoJobFacts = {
  compensation?: { readonly currency: string; readonly upperMinor?: number } | null;
  location?: { readonly remotePolicy?: "remote" | "hybrid" | "onsite" } | null;
};

export function dealBreakerVetoes(prefs: JobPreferences | null, job: VetoJobFacts): readonly HardBlocker[] {
  if (!prefs) return [];
  const out: HardBlocker[] = [];
  if (prefs.minSalary > 0 && job.compensation?.currency === prefs.currency) {
    const upperMajor = job.compensation.upperMinor != null ? job.compensation.upperMinor / 100 : null;
    if (upperMajor != null && upperMajor < prefs.minSalary) {
      out.push({
        kind: "compensation_conflict",
        provenance: [`preferences:min_salary:${prefs.minSalary}:${prefs.currency}`],
      });
    }
  }
  if (prefs.remoteOnly && job.location?.remotePolicy && job.location.remotePolicy !== "remote") {
    out.push({ kind: "incompatible_work_type", provenance: ["preferences:remote_only"] });
  }
  return out;
}

/** A vetoed match is blocked everywhere — the score itself is kept for the record. */
export function applyDealBreakers(scored: ScoredMatch, vetoes: readonly HardBlocker[]): ScoredMatch {
  if (!vetoes.length) return scored;
  return {
    ...scored,
    blockers: [...scored.blockers, ...vetoes],
    eligibility: { dailyDigest: false, reviewQueue: false, automaticEmail: false },
  };
}
