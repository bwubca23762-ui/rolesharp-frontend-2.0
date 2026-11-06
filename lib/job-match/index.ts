import type {
  AutomationBlocker,
  HardBlocker,
  MatchInput,
  MatchOutcome,
  ScoredMatch,
  SignalScore,
} from "./types";
import { MatchInputSchema, NORMALIZATION_VERSION, SCORE_VERSION } from "./types";
import { normalizeMatch } from "./normalization";
import {
  allocateDisplayPoints,
  calculateSignalDrafts,
  roundHalfUp,
  SIGNAL_WEIGHTS,
} from "./scoring-v1";

export {
  FX_VERSION,
  NORMALIZATION_VERSION,
  SCORE_VERSION,
  SIGNAL_ORDER,
} from "./types";
export type {
  AutomationBlocker,
  HardBlocker,
  HardBlockerKind,
  InvalidMatchInput,
  MatchInput,
  MatchOutcome,
  ScoredMatch,
  Signal,
  SignalScore,
} from "./types";
export { normalizeSkillText } from "./normalization";
export { SIGNAL_WEIGHTS } from "./scoring-v1";

const BASE_GATE_BLOCKERS = [
  ["expired_listing", "listingStatus", "expired"],
  ["duplicate_listing", "duplicate", true],
  ["blocked_source", "sourceBlocked", true],
  ["blocked_company", "companyBlocked", true],
  ["prior_application", "previouslyApplied", true],
] as const;

function baseBlockers(input: MatchInput): readonly HardBlocker[] {
  return BASE_GATE_BLOCKERS.flatMap(([kind, field, blocked]): readonly HardBlocker[] =>
    input.job.gates[field] === blocked ? [{ kind, provenance: [`job:gates:${field}`] }] : []);
}

function automationBlockers(input: MatchInput, matchScore: number, confidenceScore: number): readonly AutomationBlocker[] {
  const blockers: AutomationBlocker[] = [];
  if (input.job.gates.employerIdentity === "ambiguous") blockers.push("ambiguous_employer_identity");
  if (input.job.automation.emailInstruction !== "explicit") blockers.push("missing_email_instruction");
  if (input.job.automation.recipient !== "source_backed") blockers.push("unverified_recipient");
  if (input.job.automation.consent !== "current") blockers.push("inactive_consent");
  if (input.job.automation.package !== "valid") blockers.push("invalid_package");
  if (input.job.automation.answers !== "safe") blockers.push("unsafe_answers");
  if (matchScore < 85 || confidenceScore < 80) blockers.push("score_floor");
  return blockers;
}

function scoreParsedInput(input: MatchInput): ScoredMatch {
  const normalized = normalizeMatch(input);
  const drafts = calculateSignalDrafts(normalized);
  const fitParts = drafts.map((draft) => SIGNAL_WEIGHTS[draft.signal] * draft.reliability * draft.match);
  const confidenceParts = drafts.map((draft) => SIGNAL_WEIGHTS[draft.signal] * draft.reliability);
  const fitNumerator = fitParts.reduce((sum, value) => sum + value, 0);
  const confidenceNumerator = confidenceParts.reduce((sum, value) => sum + value, 0);
  const matchScore = roundHalfUp(fitNumerator, 10_000_000_000);
  const confidenceScore = roundHalfUp(confidenceNumerator, 1_000_000);
  const fitPoints = allocateDisplayPoints(fitParts, 10_000_000_000, matchScore);
  const confidencePoints = allocateDisplayPoints(confidenceParts, 1_000_000, confidenceScore);
  const signals: readonly SignalScore[] = drafts.map((draft, index) => ({
    signal: draft.signal,
    weightBasisPoints: SIGNAL_WEIGHTS[draft.signal],
    matchBasisPoints: draft.match,
    reliabilityBasisPoints: draft.reliability,
    fitNumerator: fitParts[index] ?? 0,
    confidenceNumerator: confidenceParts[index] ?? 0,
    fitDisplayPoints: fitPoints[index] ?? 0,
    confidenceDisplayPoints: confidencePoints[index] ?? 0,
    explanation: `${draft.signal}: match=${draft.match}/10000 reliability=${draft.reliability}/10000`,
    provenance: draft.provenance,
  }));
  const blockerCandidates = [...baseBlockers(input), ...drafts.flatMap((draft) => draft.blockers ?? [])];
  const blockers = blockerCandidates.filter((blocker, index) =>
    blockerCandidates.findIndex((candidate) =>
      candidate.kind === blocker.kind && candidate.canonicalSkillId === blocker.canonicalSkillId) === index);
  const automation = automationBlockers(input, matchScore, confidenceScore);
  const eligible = blockers.length === 0;
  return {
    kind: "scored",
    scoreVersion: SCORE_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    canonicalJobKey: input.job.canonicalJobKey,
    publishedAtEpochMs: input.job.freshness?.evidence === "provider" ? Date.parse(input.job.freshness.publishedAt) : 0,
    matchScore,
    confidenceScore,
    fitNumerator,
    confidenceNumerator,
    signals,
    blockers,
    automationBlockers: automation,
    eligibility: {
      dailyDigest: eligible && matchScore >= 70 && confidenceScore >= 60,
      reviewQueue: eligible && matchScore >= 75 && confidenceScore >= 65,
      automaticEmail: eligible && automation.length === 0,
    },
    negatedSkillIds: normalized.negatedSkillIds,
  };
}

export function scoreJobMatch(value: unknown): MatchOutcome {
  const parsed = MatchInputSchema.safeParse(value);
  if (!parsed.success) {
    return {
      kind: "invalid_input",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })),
    };
  }
  return scoreParsedInput(parsed.data);
}

export function rankJobMatches(matches: readonly ScoredMatch[]): readonly ScoredMatch[] {
  return [...matches].sort((left, right) =>
    right.matchScore - left.matchScore
    || right.confidenceScore - left.confidenceScore
    || right.publishedAtEpochMs - left.publishedAtEpochMs
    || (left.canonicalJobKey < right.canonicalJobKey ? -1 : left.canonicalJobKey > right.canonicalJobKey ? 1 : 0));
}
