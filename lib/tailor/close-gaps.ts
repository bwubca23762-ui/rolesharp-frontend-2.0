// Deterministic premium keyword-gap closure.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

import type { GenerateRequest } from "../types";
import { type ResumeContent as RC } from "../types";
import { dedupeSkills, titleCaseTerm } from "./skills";
import { missingKeywords, supportedMissingKeywords, targetKeywordBank } from "./keywords";
import type { RoleNorm } from "./types";

// Deterministic premium closure: after the LLM passes, mechanically surface
// any remaining JD keywords that ARE supported by the candidate's real profile
// (skills list first, then a summary strengths clause). No LLM call, no
// invention risk — every term is verified against profile evidence before use.
export function closeKeywordGaps(req: GenerateRequest, role: RoleNorm, content: RC, limit: number): RC {
  // Role-only builds close gaps against the canonical role's skill bank —
  // target-role-only generation used to return unchanged content and leave
  // 10-15 points of optimization on the table.
  const jd = req.jdText?.trim() ? req.jdText : targetKeywordBank(req, role);
  if (!jd.trim()) return content;
  const supportedMissing = supportedMissingKeywords(jd, req, content, role, limit);
  if (!supportedMissing.length) return content;
  const closed: RC = JSON.parse(JSON.stringify(content));
  closed.skills = dedupeSkills([...(closed.skills ?? []), ...supportedMissing.map(titleCaseTerm)], 20);
  const stillMissing = missingKeywords(jd, closed, 40)
    .filter((term) => supportedMissing.includes(term))
    .slice(0, 6);
  if (stillMissing.length) {
    const clause = ` Additional demonstrated strengths: ${stillMissing.map(titleCaseTerm).join(", ")}.`;
    if (!closed.summary.toLowerCase().includes("additional demonstrated strengths")) closed.summary = `${closed.summary}${clause}`;
  }
  return closed;
}
