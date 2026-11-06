// Centralized type re-exports. RoleSharp has historically declared shared
// schemas and types inline in `lib/`. This barrel gives consumers a single
// stable path (`@/types`) without rewriting the source modules, and is the
// recommended import surface for new code. Existing `@/lib/types` and
// `@/lib/job-match/types` imports continue to work unchanged.

export type {
  GenerateRequest,
  ResumeContent,
} from "@/lib/types";

export type {
  Signal,
  HardBlockerKind,
  HardBlocker,
  AutomationBlocker,
  SignalScore,
  ScoredMatch,
  InvalidMatchInput,
  MatchInput,
  MatchOutcome,
} from "@/lib/job-match/types";

// Re-export the Zod schemas (runtime values, not types) for callers that need
// to validate/parse, not just annotate.
export {
  GenerateRequest as GenerateRequestSchema,
  ResumeContent as ResumeContentSchema,
} from "@/lib/types";

export {
  MatchInputSchema,
} from "@/lib/job-match/types";
