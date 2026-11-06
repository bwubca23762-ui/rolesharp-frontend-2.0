import type {
  HardBlocker,
  MatchInput,
  Signal,
} from "./types";
import type { NormalizedMatch, NormalizedRequirement } from "./normalization";

export const SIGNAL_WEIGHTS = {
  required_skills: 2800,
  title: 1800,
  experience: 1200,
  seniority: 1000,
  preferred_skills: 800,
  location_remote: 800,
  authorization: 800,
  work_type: 300,
  compensation: 300,
  freshness: 200,
} as const satisfies Record<Signal, number>;

export type SignalDraft = {
  readonly signal: Signal;
  readonly match: number;
  readonly reliability: number;
  readonly provenance: readonly string[];
  readonly blockers?: readonly HardBlocker[];
};

export const roundHalfUp = (numerator: number, denominator: number): number =>
  Math.floor((numerator * 2 + denominator) / (denominator * 2));

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : roundHalfUp(values.reduce((sum, value) => sum + value, 0), values.length);

function skills(normalized: NormalizedMatch, requirements: readonly NormalizedRequirement[], signal: Signal): SignalDraft {
  if (requirements.length === 0) return { signal, match: 0, reliability: 0, provenance: [] };
  const matched = requirements.filter(({ id }) => normalized.candidateSkills.get(id)?.state === "possessed").length;
  const reliabilities = requirements.map((requirement) =>
    Math.min(requirement.reliability, normalized.candidateSkills.get(requirement.id)?.reliability ?? 0));
  const blockers = requirements.flatMap((requirement): readonly HardBlocker[] => {
    const candidate = normalized.candidateSkills.get(requirement.id);
    return requirement.mandatory
      && requirement.reliability >= 8500
      && candidate?.state === "not_possessed"
      && candidate.reliability >= 8500
      ? [{
        kind: "missing_mandatory_skill",
        canonicalSkillId: requirement.id,
        provenance: [...requirement.provenance, ...candidate.provenance].sort(),
      }]
      : [];
  });
  return {
    signal,
    match: roundHalfUp(10000 * matched, requirements.length),
    reliability: average(reliabilities),
    provenance: [...new Set(requirements.flatMap((requirement) => [
      ...requirement.provenance,
      ...(normalized.candidateSkills.get(requirement.id)?.provenance ?? []),
    ]))].sort(),
    blockers,
  };
}

function title(normalized: NormalizedMatch): SignalDraft {
  const job = normalized.jobTitle;
  if (job === undefined || normalized.desiredTitles.length === 0) {
    return { signal: "title", match: 0, reliability: 0, provenance: [] };
  }
  const candidates = normalized.desiredTitles.map((desired) => {
    const crossTrack = desired.track !== job.track;
    const trackAccepted = normalized.input.profile.acceptedTracks.includes("individual")
      && normalized.input.profile.acceptedTracks.includes("management");
    const match = desired.id === job.id ? 10000
      : desired.family === job.family && (!crossTrack || trackAccepted) ? 8000
      : !crossTrack && (desired.relatedFamilies.includes(job.family) || job.relatedFamilies.includes(desired.family)) ? 5000
      : 0;
    const reliability = Math.min(desired.reliability, job.reliability);
    return { desired, match, reliability };
  });
  candidates.sort((left, right) =>
    (right.reliability * right.match) - (left.reliability * left.match)
    || right.reliability - left.reliability
    || right.match - left.match
    || (left.desired.id < right.desired.id ? -1 : left.desired.id > right.desired.id ? 1 : 0));
  const best = candidates[0];
  return best === undefined
    ? { signal: "title", match: 0, reliability: 0, provenance: [] }
    : { signal: "title", match: best.match, reliability: best.reliability, provenance: [`title:${best.desired.id}`, `title:${job.id}`] };
}

function experience(input: MatchInput): SignalDraft {
  const job = input.job.experience;
  const profile = input.profile.relevantExperience;
  if (job === undefined || profile === undefined) return { signal: "experience", match: 0, reliability: 0, provenance: [] };
  const reliability = job.evidence === "explicit" && profile.evidence === "verified_dated" ? 10000 : 7000;
  const match = job.minimumMonths === 0 ? 10000
    : Math.min(10000, roundHalfUp(10000 * profile.months, job.minimumMonths));
  const blockers: readonly HardBlocker[] = job.nonNegotiable
    && job.evidence === "explicit"
    && profile.evidence === "verified_dated"
    && profile.months < job.minimumMonths
    ? [{ kind: "below_non_negotiable_experience", provenance: ["job:experience", "profile:experience"] }]
    : [];
  return { signal: "experience", match, reliability, provenance: ["job:experience", "profile:experience"], blockers };
}

const LEVELS = ["intern", "entry", "mid", "senior", "staff_or_lead", "principal"] as const;
function seniority(input: MatchInput): SignalDraft {
  const job = input.job.seniority;
  const profile = input.profile.seniority;
  if (job === undefined || profile === undefined) return { signal: "seniority", match: 0, reliability: 0, provenance: [] };
  const reliability = job.evidence === "explicit" && profile.evidence === "explicit" ? 10000 : 7000;
  const crossTrack = job.track !== profile.track;
  const trackAccepted = input.profile.acceptedTracks.includes("individual")
    && input.profile.acceptedTracks.includes("management");
  const distance = Math.abs(LEVELS.indexOf(job.level) - LEVELS.indexOf(profile.level));
  const match = crossTrack && !trackAccepted ? 0 : distance === 0 ? 10000 : distance === 1 ? 6000 : 0;
  const blockers: readonly HardBlocker[] = job.evidence === "explicit"
    && profile.evidence === "explicit"
    && job.forbiddenLevels.includes(profile.level)
    ? [{ kind: "forbidden_seniority", provenance: ["job:seniority", "profile:seniority"] }]
    : [];
  return { signal: "seniority", match, reliability, provenance: ["job:seniority", "profile:seniority"], blockers };
}

function location(input: MatchInput): SignalDraft {
  const job = input.job.location;
  const profileReliability = input.profile.preferenceEvidence === "confirmed" ? 10000
    : input.profile.preferenceEvidence === "inferred" ? 6000 : 0;
  if (job === undefined || job.evidence === "unknown" || profileReliability === 0) {
    return { signal: "location_remote", match: 0, reliability: 0, provenance: [] };
  }
  const jobReliability = job.evidence === "explicit" ? 10000 : 6000;
  const remoteAccepted = input.profile.remotePolicies.includes(job.remotePolicy);
  const priorities = input.profile.locationPreferences
    .filter(({ location: value }) => job.locations.includes(value))
    .map(({ priority }) => priority);
  const desired = input.profile.remotePolicies[0] === job.remotePolicy && priorities.includes("desired");
  const acceptable = remoteAccepted && priorities.length > 0;
  const blockers: readonly HardBlocker[] = !acceptable && job.evidence === "explicit" && profileReliability === 10000
    ? [{ kind: "incompatible_location", provenance: ["job:location", "profile:location"] }]
    : [];
  return {
    signal: "location_remote",
    match: desired ? 10000 : acceptable ? 8000 : 0,
    reliability: Math.min(jobReliability, profileReliability),
    provenance: ["job:location", "profile:location"],
    blockers,
  };
}

function authorization(input: MatchInput): SignalDraft {
  const job = input.job.authorization;
  const profile = input.profile.authorization;
  if (job === undefined || profile.evidence === "unknown" || profile.state === "unknown") {
    return { signal: "authorization", match: 0, reliability: 0, provenance: [] };
  }
  if (job.sponsorship === "silent") {
    return { signal: "authorization", match: 0, reliability: profile.evidence === "confirmed" ? 4000 : 0, provenance: ["job:authorization", "profile:authorization"] };
  }
  const incompatible = profile.state === "needs_sponsorship" && job.sponsorship === "unavailable";
  const reliability = job.evidence === "explicit" && profile.evidence === "confirmed" ? 10000 : 6000;
  return {
    signal: "authorization",
    match: incompatible ? 0 : 10000,
    reliability,
    provenance: ["job:authorization", "profile:authorization"],
    blockers: incompatible && reliability === 10000
      ? [{ kind: "incompatible_authorization", provenance: ["job:authorization", "profile:authorization"] }]
      : [],
  };
}

function workType(input: MatchInput): SignalDraft {
  const job = input.job.workType;
  const preference = job === undefined ? undefined : input.profile.workTypes.find(({ type }) => type === job.type);
  if (job === undefined || job.evidence === "unknown" || input.profile.preferenceEvidence === "unknown") {
    return { signal: "work_type", match: 0, reliability: 0, provenance: [] };
  }
  const reliability = job.evidence === "explicit" && input.profile.preferenceEvidence === "confirmed" ? 10000 : 6000;
  return {
    signal: "work_type",
    match: preference?.priority === "desired" ? 10000 : preference?.priority === "acceptable" ? 8000 : 0,
    reliability,
    provenance: ["job:work_type", "profile:work_type"],
    blockers: preference === undefined && reliability === 10000
      ? [{ kind: "incompatible_work_type", provenance: ["job:work_type", "profile:work_type"] }]
      : [],
  };
}

const PERIOD_FACTOR = { hourly: 2080, daily: 260, weekly: 52, monthly: 12, annual: 1 } as const;
const annualizedBase = (
  amount: number,
  period: keyof typeof PERIOD_FACTOR,
  rate: MatchInput["fxSnapshot"]["rates"][number] | undefined,
): bigint => {
  const annualized = BigInt(amount) * BigInt(PERIOD_FACTOR[period]);
  return rate === undefined ? annualized
    : (annualized * BigInt(rate.numerator) * 2n + BigInt(rate.denominator)) / (BigInt(rate.denominator) * 2n);
};

function compensation(input: MatchInput): SignalDraft {
  const job = input.job.compensation;
  const floor = input.profile.compensationFloor;
  if (job === undefined || floor === undefined) return { signal: "compensation", match: 0, reliability: 0, provenance: [] };
  const direct = job.currency === floor.currency;
  const jobRate = input.fxSnapshot.rates.find(({ currency }) => currency === job.currency);
  const floorRate = input.fxSnapshot.rates.find(({ currency }) => currency === floor.currency);
  if (!direct && (jobRate === undefined || floorRate === undefined)) {
    return { signal: "compensation", match: 0, reliability: 0, provenance: [] };
  }
  const target = annualizedBase(floor.amountMinor, floor.period, direct ? undefined : floorRate);
  const lower = job.lowerMinor === undefined ? undefined : annualizedBase(job.lowerMinor, job.period, direct ? undefined : jobRate);
  const upper = job.upperMinor === undefined ? undefined : annualizedBase(job.upperMinor, job.period, direct ? undefined : jobRate);
  const conflict = upper !== undefined && upper < target;
  const match = lower !== undefined && lower >= target ? 10000
    : lower !== undefined && upper !== undefined && lower < target && target <= upper ? 6000 : 0;
  const reliability = job.evidence !== "explicit" || (match === 0 && !conflict) ? 0
    : direct && job.period === floor.period ? 10000 : 8000;
  return {
    signal: "compensation", match, reliability, provenance: ["job:compensation", "profile:compensation", `fx:${input.fxSnapshot.version}`],
    blockers: conflict && reliability > 0
      ? [{ kind: "compensation_conflict", provenance: ["job:compensation", "profile:compensation"] }]
      : [],
  };
}

function freshness(input: MatchInput): SignalDraft {
  const value = input.job.freshness;
  if (value === undefined) return { signal: "freshness", match: 0, reliability: 0, provenance: [] };
  const published = Date.parse(value.publishedAt);
  const captured = Date.parse(value.capturedAt);
  if (published - captured > 300_000) return { signal: "freshness", match: 0, reliability: 0, provenance: ["job:freshness"] };
  const days = Math.floor(Math.max(0, captured - published) / 86_400_000);
  const match = days <= 3 ? 10000 : days <= 7 ? 8000 : days <= 14 ? 5000 : days <= 30 ? 2000 : 0;
  const blockers: readonly HardBlocker[] = days > 30 ? [{ kind: "expired_listing", provenance: ["job:freshness"] }] : [];
  return { signal: "freshness", match, reliability: value.evidence === "provider" ? 10000 : 5000, provenance: ["job:freshness"], blockers };
}

export function allocateDisplayPoints(numerators: readonly number[], denominator: number, total: number): readonly number[] {
  const floors = numerators.map((value) => Math.floor(value / denominator));
  const remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = numerators.map((value, index) => ({ index, remainder: value % denominator }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const { index } of order.slice(0, remainder)) floors[index] = (floors[index] ?? 0) + 1;
  return floors;
}

export function calculateSignalDrafts(normalized: NormalizedMatch): readonly SignalDraft[] {
  const input = normalized.input;
  return [
    skills(normalized, normalized.requiredSkills, "required_skills"),
    title(normalized),
    experience(input),
    seniority(input),
    skills(normalized, normalized.preferredSkills, "preferred_skills"),
    location(input),
    authorization(input),
    workType(input),
    compensation(input),
    freshness(input),
  ];
}
