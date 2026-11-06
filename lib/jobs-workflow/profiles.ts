import { withTransaction } from "../db";
import type { CareerProfileInput } from "./contracts";
import { canonicalHash } from "./canonical-json";

function normalizedProfile(input: CareerProfileInput) {
  return {
    desiredTitles: input.desiredTitles.map((text) => ({ text, evidence: "explicit" as const })),
    skills: input.skills.map((skill, index) => ({
      text: skill.name, state: skill.state, evidence: "explicit_current" as const,
      sourceId: `profile:user:${index + 1}`,
    })),
    ...(input.relevantExperienceMonths === undefined ? {} : {
      relevantExperience: { months: input.relevantExperienceMonths, evidence: "inferred" as const },
    }),
    ...(input.seniority === undefined ? {} : {
      seniority: { ...input.seniority, evidence: "explicit" as const },
    }),
    acceptedTracks: input.acceptedTracks,
    locationPreferences: input.locations.map((location) => ({ location, priority: "desired" as const })),
    remotePolicies: input.remotePolicies,
    preferenceEvidence: "confirmed" as const,
    authorization: { state: input.authorization, evidence: "confirmed" as const },
    workTypes: input.workTypes.map((type) => ({ type, priority: "desired" as const })),
    ...(input.compensationFloor === undefined ? {} : { compensationFloor: input.compensationFloor }),
  };
}

export async function createCareerProfileVersion(userId: string, input: CareerProfileInput) {
  const facts = normalizedProfile(input);
  const provenance = {
    version: 1,
    source: "user_confirmed",
    fields: Object.keys(facts).sort(),
  };
  return withTransaction(async (query) => {
    const owner = (await query<{ id: string; deleting_at: string | null }>(
      "select id,deleting_at from users where id=$1 for update", [userId],
    ))[0];
    if (!owner || owner.deleting_at) throw new Error("account_unavailable");
    const version = Number((await query<{ version: number }>(
      "select coalesce(max(version),0)+1 version from career_profile_versions where user_id=$1", [userId],
    ))[0]?.version ?? 1);
    const row = (await query(
      `insert into career_profile_versions(user_id,version,normalized_facts,provenance,facts_hash)
       values($1,$2,$3,$4,$5) returning id,user_id,version,normalized_facts,provenance,facts_hash,created_at`,
      [userId, version, facts, provenance, canonicalHash(facts)],
    ))[0];
    return row;
  });
}

export async function listCareerProfileVersions(userId: string) {
  return withTransaction((query) => query(
    `select id,version,normalized_facts,provenance,facts_hash,created_at
     from career_profile_versions where user_id=$1 order by version desc`, [userId],
  ));
}
