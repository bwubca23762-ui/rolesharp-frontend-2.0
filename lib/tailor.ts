// Compatibility barrel — preserves the public lib/tailor entry point.
// All implementation has moved to lib/tailor/ modules.
// Provenance: Phase 6 monolith refactor.

export { tailor } from "./tailor/orchestration";
export type { RoleNorm, RequirementMap } from "./tailor/types";
export { parseGeneratedContent } from "./tailor/normalization";
