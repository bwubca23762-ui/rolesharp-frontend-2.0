import skillTaxonomy from "./skill-taxonomy-v1.json";
import titleTaxonomy from "./title-taxonomy-v1.json";
import type { MatchInput } from "./types";

type SkillState = MatchInput["profile"]["skills"][number]["state"];
type RequirementKind = MatchInput["job"]["skillRequirements"][number]["kind"];
type SkillFact = {
  readonly id: string;
  readonly state: SkillState;
  readonly reliability: number;
  readonly provenance: readonly string[];
};
export type NormalizedRequirement = {
  readonly id: string;
  readonly kind: Exclude<RequirementKind, "negated">;
  readonly mandatory: boolean;
  readonly reliability: number;
  readonly provenance: readonly string[];
};
export type NormalizedTitle = {
  readonly id: string;
  readonly canonical: string;
  readonly family: string;
  readonly track: string;
  readonly relatedFamilies: readonly string[];
  readonly reliability: number;
};
export type NormalizedMatch = {
  readonly input: MatchInput;
  readonly candidateSkills: ReadonlyMap<string, SkillFact>;
  readonly requiredSkills: readonly NormalizedRequirement[];
  readonly preferredSkills: readonly NormalizedRequirement[];
  readonly negatedSkillIds: readonly string[];
  readonly desiredTitles: readonly NormalizedTitle[];
  readonly jobTitle?: NormalizedTitle;
};

const normalizeLexeme = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\.(?=\s|$)/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const containsPhrase = (text: string, phrase: string): boolean =>
  ` ${text} `.includes(` ${phrase} `);

const skillAliases = (() => {
  /** Initialization accumulator; immutable after module load. */
  const aliases = new Map<string, readonly string[]>();
  for (const skill of skillTaxonomy.skills) {
    for (const rawAlias of skill.aliases) {
      const alias = normalizeLexeme(rawAlias);
      const ids = aliases.get(alias) ?? [];
      aliases.set(alias, [...new Set([...ids, skill.id])].sort());
    }
  }
  return aliases;
})();

export function normalizeSkillText(value: string): readonly string[] {
  const normalized = normalizeLexeme(value);
  const matches = new Set<string>();
  for (const [alias, ids] of skillAliases) {
    if (ids.length === 1 && containsPhrase(normalized, alias)) {
      const id = ids[0];
      if (id !== undefined) matches.add(id);
    }
  }
  return [...matches].sort();
}

const CANDIDATE_RELIABILITY = {
  authoritative_current: 10000,
  explicit_current: 8500,
  resume_positive: 6000,
  unknown: 0,
} as const satisfies Record<MatchInput["profile"]["skills"][number]["evidence"], number>;

const candidateReliability = (
  evidence: MatchInput["profile"]["skills"][number]["evidence"],
  state: SkillState,
): number => state === "unknown" || (evidence === "resume_positive" && state !== "possessed")
  ? 0 : CANDIDATE_RELIABILITY[evidence];

const REQUIREMENT_RELIABILITY = {
  labeled_list: 10000,
  explicit_prose: 8500,
  heuristic: 5000,
  absent: 0,
} as const satisfies Record<MatchInput["job"]["skillRequirements"][number]["evidence"], number>;

const looksNegated = (value: string): boolean => {
  const text = normalizeLexeme(value);
  return /^(no|not|without)\b/.test(text)
    || /\b(does not require|not required|not necessary|not needed)\b/.test(text);
};

function normalizeCandidateSkills(input: MatchInput): ReadonlyMap<string, SkillFact> {
  /** Normalization accumulator; returned as a read-only map. */
  const grouped = new Map<string, { state: SkillState; reliability: number; provenance: Set<string> }[]>();
  for (const fact of input.profile.skills) {
    for (const id of normalizeSkillText(fact.text)) {
      const reliability = candidateReliability(fact.evidence, fact.state);
      const current = grouped.get(id) ?? [];
      current.push({ state: fact.state, reliability, provenance: new Set([fact.sourceId]) });
      grouped.set(id, current);
    }
  }
  const result = new Map<string, SkillFact>();
  for (const [id, facts] of grouped) {
    const strongest = Math.max(...facts.map(({ reliability }) => reliability));
    const top = facts.filter(({ reliability }) => reliability === strongest);
    const knownStates = new Set(top.filter(({ state }) => state !== "unknown").map(({ state }) => state));
    const state = knownStates.size === 1 ? [...knownStates][0] ?? "unknown" : "unknown";
    result.set(id, {
      id,
      state,
      reliability: state === "unknown" ? 0 : strongest,
      provenance: [...new Set(top.flatMap(({ provenance }) => [...provenance]))].sort(),
    });
  }
  return result;
}

function normalizeRequirements(input: MatchInput): {
  readonly required: readonly NormalizedRequirement[];
  readonly preferred: readonly NormalizedRequirement[];
  readonly negated: readonly string[];
} {
  /** Dedupe accumulator: repeated aliases can contribute only once. */
  const grouped = new Map<string, {
    kind: RequirementKind;
    mandatory: boolean;
    reliability: number;
    provenance: Set<string>;
  }>();
  const negated = new Set<string>();
  for (const requirement of input.job.skillRequirements) {
    for (const id of normalizeSkillText(requirement.text)) {
      if (requirement.kind === "negated" || looksNegated(requirement.text)) {
        negated.add(id);
        continue;
      }
      const current = grouped.get(id);
      const reliability = REQUIREMENT_RELIABILITY[requirement.evidence];
      const kind = current?.kind === "required" || requirement.kind === "required" ? "required" : "preferred";
      grouped.set(id, {
        kind,
        mandatory: (current?.mandatory ?? false) || requirement.mandatory,
        reliability: Math.max(current?.reliability ?? 0, reliability),
        provenance: new Set([...(current?.provenance ?? []), requirement.sourceId]),
      });
    }
  }
  const values = [...grouped.entries()]
    .filter(([id]) => !negated.has(id))
    .map(([id, value]) => ({
      id,
      kind: value.kind === "required" ? "required" as const : "preferred" as const,
      mandatory: value.mandatory,
      reliability: value.reliability,
      provenance: [...value.provenance].sort(),
    }))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  return {
    required: values.filter(({ kind }) => kind === "required"),
    preferred: values.filter(({ kind }) => kind === "preferred"),
    negated: [...negated].sort(),
  };
}

function normalizeTitle(
  value: string,
  evidence: "explicit" | "structured" | "inferred" | "unknown",
): NormalizedTitle | undefined {
  if (evidence === "unknown") return undefined;
  const normalized = normalizeLexeme(value);
  const exact = titleTaxonomy.titles.filter(({ canonical }) => normalizeLexeme(canonical) === normalized);
  const aliases = titleTaxonomy.titles.filter((title) =>
    title.aliases.some((alias) => containsPhrase(normalized, normalizeLexeme(alias))),
  );
  const matches = exact.length > 0 ? exact : aliases;
  if (matches.length !== 1) return undefined;
  const match = matches[0];
  if (match === undefined) return undefined;
  return {
    ...match,
    reliability: exact.length === 1 && evidence !== "inferred" ? 10000 : 7000,
  };
}

export function normalizeMatch(input: MatchInput): NormalizedMatch {
  const requirements = normalizeRequirements(input);
  return {
    input,
    candidateSkills: normalizeCandidateSkills(input),
    requiredSkills: requirements.required,
    preferredSkills: requirements.preferred,
    negatedSkillIds: requirements.negated,
    desiredTitles: input.profile.desiredTitles
      .map(({ text, evidence }) => normalizeTitle(text, evidence))
      .filter((title): title is NormalizedTitle => title !== undefined),
    jobTitle: input.job.title === undefined
      ? undefined
      : normalizeTitle(input.job.title.text, input.job.title.evidence),
  };
}
