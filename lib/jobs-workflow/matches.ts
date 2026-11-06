import { createHash } from "node:crypto";
import { q, withTransaction, type TransactionQuery } from "../db";
import { activeFeatureAccessInTransaction } from "../feature-access";
import { FX_VERSION, NORMALIZATION_VERSION, SCORE_VERSION, scoreJobMatch } from "../job-match";
import { applyDealBreakers, dealBreakerVetoes, rubricDimensions } from "../job-match/scoring-v2";
import { getJobPreferences, type JobPreferences } from "../job-preferences";
import { canonicalCompanyIdentity, canonicalizeOfficialApplicationUrl, providerFallbackJobKey } from "../job-match/canonical-identity";
import { extractIndexedJobFacts } from "../job-match/job-extraction";
import type { CampaignCriteria } from "./contracts";
import { workflowFlagEnabled } from "./flags";

/**
 * How many candidate jobs one campaign run scores. Each candidate costs a
 * snapshot write plus a scoring pass, so this bounds the transaction. It is a
 * cap on the *eligible* pool -- see the query in materializeCampaignMatches.
 */
const MATCH_CANDIDATE_LIMIT = 500;

type IndexedJob = {
  id: string; provider: string; external_id: string; title: string; company: string;
  country_code: string; location: string | null; is_remote: boolean; job_type: string | null;
  description: string | null; apply_url: string; source_url: string | null; company_url: string | null;
  salary_min: string | null; salary_max: string | null; salary_currency: string | null;
  salary_interval: string | null; date_posted: string | null; last_seen_at: string; expires_at: string;
  metadata: Record<string, unknown>;
};

type CampaignRow = {
  id: string; user_id: string; mode: "daily_matches" | "role_apply";
  authorization_mode: "review_each" | "campaign_policy"; status: string;
  profile_version_id: string; criteria: CampaignCriteria; criteria_version: number;
  fit_score_floor: number; confidence_score_floor: number; consent_expires_at: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en");
}

async function persistCanonicalIdentity(query: TransactionQuery, job: IndexedJob) {
  const official = canonicalizeOfficialApplicationUrl(job.apply_url);
  const canonicalJobKey = official?.canonicalJobKey ?? providerFallbackJobKey(job.provider, job.external_id);
  const company = canonicalCompanyIdentity({
    employerId: job.metadata?.employer_id,
    companyUrl: job.company_url,
    companyName: job.company,
  });
  await query(
    `insert into canonical_companies(canonical_company_key,verified_employer_id,verified_domain,
       identity_confidence,identity_state,automation_blocked)
     values($1,$2,$3,$4,$5,$6) on conflict(canonical_company_key) do nothing`,
    [company.canonicalCompanyKey, company.verifiedEmployerId, company.verifiedDomain,
      company.state === "verified" ? 10000 : 0, company.state, company.automationBlocked],
  );
  const existingJob = (await query<{ canonical_company_key: string; automation_blocked: boolean }>(
    "select canonical_company_key,automation_blocked from canonical_jobs where canonical_job_key=$1 for update",
    [canonicalJobKey],
  ))[0];
  let companyKey = company.canonicalCompanyKey;
  let identityConflict = false;
  if (existingJob && existingJob.canonical_company_key !== companyKey) {
    identityConflict = true;
    companyKey = existingJob.canonical_company_key as typeof companyKey;
    await query(
      "update canonical_jobs set merge_state='conflicted',automation_blocked=true,updated_at=now() where canonical_job_key=$1",
      [canonicalJobKey],
    );
  } else if (!existingJob) {
    await query(
      `insert into canonical_jobs(canonical_job_key,canonical_company_key,key_kind,official_url_hash,
         url_policy_version,automation_blocked)
       values($1,$2,$3,$4,1,$5)`,
      [canonicalJobKey, companyKey, official ? "verified_url_hash" : "provider_fallback",
        official?.urlHash ?? null, company.automationBlocked],
    );
  }
  const alias = (await query<{ canonical_job_key: string }>(
    "select canonical_job_key from canonical_job_aliases where provider_namespace=$1 and provider_job_id=$2 for update",
    [job.provider, job.external_id],
  ))[0];
  let aliasConflict = false;
  if (alias && alias.canonical_job_key !== canonicalJobKey) {
    aliasConflict = true;
    await query(
      "update canonical_jobs set automation_blocked=true,merge_state='conflicted',updated_at=now() where canonical_job_key=any($1::text[])",
      [[alias.canonical_job_key, canonicalJobKey]],
    );
  } else if (!alias) {
    await query(
      `insert into canonical_job_aliases(provider_namespace,provider_job_id,canonical_job_key,
         verified_official_url_hash,url_policy_version) values($1,$2,$3,$4,1)`,
      [job.provider, job.external_id, canonicalJobKey, official?.urlHash ?? null],
    );
  }
  return { canonicalJobKey, canonicalCompanyKey: companyKey, company, aliasConflict, identityConflict };
}

function profileForCampaign(profile: any, criteria: CampaignCriteria, job: IndexedJob) {
  const locations = criteria.locations.length
    ? criteria.locations.map((location) => ({ location, priority: "desired" as const }))
    : [...(profile.locationPreferences ?? [])];
  if (criteria.countries.includes(job.country_code) && job.location && !locations.some((item) => item.location === job.location)) {
    locations.push({ location: job.location, priority: "acceptable" });
  }
  const remotePolicies = criteria.remotePolicies.length ? criteria.remotePolicies : profile.remotePolicies;
  const workTypes = criteria.workTypes.length
    ? criteria.workTypes.map((type) => ({ type, priority: "desired" as const }))
    : profile.workTypes;
  const hasPreferences = locations.length > 0 || remotePolicies.length > 0 || workTypes.length > 0;
  return {
    ...profile,
    desiredTitles: criteria.desiredTitles.map((text) => ({ text, evidence: "explicit" as const })),
    locationPreferences: locations,
    remotePolicies,
    workTypes,
    preferenceEvidence: hasPreferences ? "confirmed" as const : "unknown" as const,
    ...(criteria.authorization === "unknown" || criteria.authorization === "either" ? {} : {
      authorization: { state: criteria.authorization, evidence: "confirmed" as const },
    }),
    ...(criteria.compensationFloor ? { compensationFloor: criteria.compensationFloor } : {}),
  };
}

async function materializeOne(query: TransactionQuery, campaign: CampaignRow, profile: any, job: IndexedJob, preferences: JobPreferences | null) {
  const identity = await persistCanonicalIdentity(query, job);
  const sourceBody = (job.description ?? "").slice(0, 500_000);
  const bodyHash = sha256(sourceBody);
  const sourceUrl = /^https?:\/\//iu.test(job.source_url ?? "") ? job.source_url! : job.apply_url;
  const extracted = extractIndexedJobFacts({
    ...job,
    recipientProvenance: {
      canonicalJobKey: identity.canonicalJobKey,
      sourceUrl,
      providerNamespace: job.provider,
      providerJobId: job.external_id,
      capturedAt: job.last_seen_at,
      expectedEmployerDomain: identity.company.verifiedDomain ?? undefined,
      contentHash: bodyHash,
    },
  }, identity.canonicalJobKey);
  const capturedAt = new Date(job.last_seen_at);
  const publishedAt = job.date_posted && new Date(job.date_posted).getTime() <= capturedAt.getTime() + 300_000
    ? job.date_posted : null;
  let snapshot = (await query<{ id: string }>(
    `insert into job_snapshots(canonical_job_key,canonical_company_key,provider_namespace,provider_job_id,
       source_url,source_body,source_body_hash,captured_at,published_at,expires_at,facts)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict(canonical_job_key,source_body_hash,captured_at) do nothing returning id`,
    [identity.canonicalJobKey, identity.canonicalCompanyKey, job.provider, job.external_id,
      sourceUrl,
      sourceBody, bodyHash, job.last_seen_at, publishedAt,
      job.expires_at, extracted],
  ))[0];
  snapshot ??= (await query<{ id: string }>(
    `select id from job_snapshots where canonical_job_key=$1 and source_body_hash=$2
     and captured_at=$3`, [identity.canonicalJobKey, bodyHash, job.last_seen_at],
  ))[0];
  if (!snapshot) throw new Error("snapshot_persistence_failed");
  const priorApplication = Boolean((await query<{ present: boolean }>(
    `select true present from applications where user_id_text=$1
       and (canonical_job_key=$2 or (provider_namespace=$3 and provider_job_id=$4)) limit 1`,
    [campaign.user_id, identity.canonicalJobKey, job.provider, job.external_id],
  ))[0]);
  const blockedSource = campaign.criteria.blockedSources.map(normalized).includes(normalized(job.provider));
  const blockedCompany = campaign.criteria.excludedCompanies.map(normalized).includes(normalized(job.company));
  const blockedCountry = campaign.criteria.countries.length > 0 && !campaign.criteria.countries.includes(job.country_code);
  const consentCurrent = campaign.authorization_mode === "review_each"
    || Boolean(campaign.consent_expires_at && new Date(campaign.consent_expires_at) > new Date());
  const { recipient, ...jobFacts } = extracted;
  const matchProfile = profileForCampaign(profile, campaign.criteria, job);
  const rates = matchProfile.compensationFloor && jobFacts.compensation
    && matchProfile.compensationFloor.currency === jobFacts.compensation.currency
    ? [{ currency: jobFacts.compensation.currency, numerator: 1, denominator: 1 }] : [];
  const outcome = scoreJobMatch({
    scoreVersion: SCORE_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    profile: matchProfile,
    job: {
      ...jobFacts,
      gates: {
        listingStatus: new Date(job.expires_at) > new Date() ? "active" : "expired",
        duplicate: identity.aliasConflict || identity.identityConflict,
        sourceBlocked: blockedSource,
        companyBlocked: blockedCompany || blockedCountry,
        previouslyApplied: priorApplication,
        employerIdentity: identity.company.state === "verified" ? "verified" : "ambiguous",
      },
      automation: {
        emailInstruction: recipient.emailInstruction,
        recipient: recipient.recipient,
        consent: consentCurrent ? "current" : "expired",
        package: "missing",
        answers: "safe",
      },
    },
    fxSnapshot: { version: FX_VERSION, rates },
  });
  if (outcome.kind === "invalid_input") {
    throw new Error(`invalid_match_input:${outcome.issues.map((issue) => issue.path).join(",")}`);
  }
  // Deal-breaker overlay (rubric v2): declared preferences veto a posting no
  // matter its score. No preferences = no vetoes = v1 behaviour, and the row
  // persists under score_version 1; with preferences the row lands under
  // score_version 2 so the two eras never collide on the conflict key.
  const scoreVersion = preferences ? 2 : 1;
  const vetoes = dealBreakerVetoes(preferences, {
    compensation: jobFacts.compensation ?? null,
    location: jobFacts.location ?? null,
  });
  const effective = applyDealBreakers(outcome, vetoes);
  const meetsCampaignFloor = outcome.matchScore >= campaign.fit_score_floor
    && outcome.confidenceScore >= campaign.confidence_score_floor;
  const blockers = [
    ...effective.blockers,
    ...(meetsCampaignFloor ? [] : [{ kind: "below_campaign_threshold", provenance: ["campaign:score_floors"] }]),
    ...(identity.aliasConflict ? [{ kind: "canonical_alias_conflict", provenance: ["job:provider_alias"] }] : []),
  ];
  const status = effective.blockers.length === 0 && meetsCampaignFloor ? "eligible" : "excluded";
  const inserted = (await query<any>(
    `insert into job_matches(user_id,campaign_id,profile_version_id,job_snapshot_id,
       canonical_job_key,canonical_company_key,score_version,fit_score,confidence_score,
       fit_numerator,confidence_numerator,breakdown,provenance,blockers,status,ranked_at)
     values($1,$2,$3,$4,$5,$6,${scoreVersion},$7,$8,$9,$10,$11,$12,$13,$14,now())
     on conflict(user_id,campaign_id,profile_version_id,job_snapshot_id,score_version) do nothing
     returning id,status,fit_score,confidence_score`,
    [campaign.user_id, campaign.id, campaign.profile_version_id, snapshot.id,
      identity.canonicalJobKey, identity.canonicalCompanyKey, outcome.matchScore,
      outcome.confidenceScore, outcome.fitNumerator, outcome.confidenceNumerator,
      { signals: effective.signals, rubric: rubricDimensions(effective.signals), eligibility: effective.eligibility, automationBlockers: effective.automationBlockers },
      { scoreVersion: SCORE_VERSION, normalizationVersion: NORMALIZATION_VERSION, criteriaVersion: campaign.criteria_version },
      JSON.stringify(blockers), status],
  ))[0];
  const persistedId = inserted?.id ?? (await query<{ id: string }>(
    `select id from job_matches where user_id=$1 and campaign_id=$2 and profile_version_id=$3
       and job_snapshot_id=$4 and score_version=${scoreVersion}`,
    [campaign.user_id, campaign.id, campaign.profile_version_id, snapshot.id],
  ))[0]?.id;
  if (persistedId && status === "eligible" && campaign.mode === "role_apply") {
    await query(
      `insert into job_work_items(user_id,kind,aggregate_id,dedupe_key)
       values($1,'application_package',$2,$3) on conflict(kind,dedupe_key) do nothing`,
      [campaign.user_id, persistedId, `${persistedId}:package:v1`],
    );
  }
  return inserted ? 1 : 0;
}

export async function materializeCampaignMatches(campaignId: string): Promise<{ created: number }> {
  const mode = (await q<{ mode: "daily_matches" | "role_apply" }>(
    "select mode from job_campaigns where id=$1 and status='active'", [campaignId],
  ))[0]?.mode;
  if (!mode) return { created: 0 };
  const enabled = mode === "daily_matches"
    ? await workflowFlagEnabled("jobs_daily_matches")
    : await workflowFlagEnabled("role_apply_prepare");
  if (!enabled) return { created: 0 };
  return withTransaction(async (query) => {
    const campaign = (await query<CampaignRow>(
      `select * from job_campaigns where id=$1 and status='active'
         and workflow_rollout_allows(case when mode='daily_matches' then 'jobs_daily_matches' else 'role_apply_prepare' end,user_id)
       for update`, [campaignId],
    ))[0];
    if (!campaign) return { created: 0 };
    await activeFeatureAccessInTransaction(
      query,
      campaign.user_id,
      campaign.mode === "daily_matches" ? "daily_matches" : "role_apply_prepare",
    );
    const profile = (await query<{ normalized_facts: any }>(
      "select normalized_facts from career_profile_versions where id=$1 and user_id=$2",
      [campaign.profile_version_id, campaign.user_id],
    ))[0]?.normalized_facts;
    if (!profile) throw new Error("profile_not_found");
    // Declared deal breakers are read once per run (not per job) and applied
    // as a veto overlay in materializeOne. No row = no overlay = scoring and
    // persistence identical to before this existed.
    const preferences: JobPreferences | null = await getJobPreferences(campaign.user_id).catch(() => null);
    // The candidate cap has to be applied to jobs this campaign could actually
    // match, not to the global newest. Without the country predicate a campaign
    // targeting one country is starved by unrelated fresh jobs and silently
    // returns nothing. materializeOne still applies the authoritative country
    // check, so this only changes which rows reach it -- never the outcome.
    // Backed by jobs_country_fresh_idx (country_code, date_posted, last_seen_at).
    const countries = campaign.criteria.countries;
    const jobs = await query<IndexedJob>(
      `select id,provider,external_id,title,company,country_code,location,is_remote,job_type,
         description,apply_url,source_url,company_url,salary_min,salary_max,salary_currency,
         salary_interval,date_posted,last_seen_at,expires_at,metadata
       from jobs
       where expires_at>now()${countries.length > 0 ? " and country_code = any($1)" : ""}
       order by last_seen_at desc,provider,external_id
       limit ${MATCH_CANDIDATE_LIMIT}`,
      countries.length > 0 ? [countries] : [],
    );
    let created = 0;
    const seen = new Set<string>();
    for (const job of jobs) {
      const official = canonicalizeOfficialApplicationUrl(job.apply_url);
      const key = official?.canonicalJobKey ?? providerFallbackJobKey(job.provider, job.external_id);
      if (seen.has(key)) continue;
      seen.add(key);
      created += await materializeOne(query, campaign, profile, job, preferences);
    }
    return { created };
  });
}

export async function listJobMatches(input: {
  userId: string; campaignId?: string; status?: "eligible" | "excluded" | "consumed" | "stale";
  cursor?: string; limit: number;
}) {
  const values: unknown[] = [input.userId, input.limit + 1];
  const where = ["m.user_id=$1"];
  if (input.campaignId) { values.push(input.campaignId); where.push(`m.campaign_id=$${values.length}`); }
  if (input.status) { values.push(input.status); where.push(`m.status=$${values.length}`); }
  if (input.cursor) {
    values.push(input.cursor);
    where.push(`(m.fit_score,m.confidence_score,m.ranked_at,m.id) < (
      select fit_score,confidence_score,ranked_at,id from job_matches where id=$${values.length} and user_id=$1
    )`);
  }
  const rows = await q<any>(
    `select m.id,m.campaign_id,m.canonical_job_key,m.canonical_company_key,m.fit_score,
       m.confidence_score,m.breakdown,m.blockers,m.status,m.ranked_at,m.created_at,
       s.facts,s.source_url,s.expires_at,s.provider_namespace,s.provider_job_id,
       j.id indexed_job_id,j.title,j.company,j.location
     from job_matches m join job_snapshots s on s.id=m.job_snapshot_id
     left join jobs j on j.provider=s.provider_namespace and j.external_id=s.provider_job_id
     where ${where.join(" and ")}
     order by m.fit_score desc,m.confidence_score desc,m.ranked_at desc,m.id desc limit $2`,
    values,
  );
  const hasMore = rows.length > input.limit;
  const matches = rows.slice(0, input.limit);
  return { matches, nextCursor: hasMore ? matches.at(-1)?.id ?? null : null };
}

export async function getJobMatch(userId: string, id: string) {
  return (await q<any>(
    `select m.*,s.facts,s.source_url,s.source_body_hash,s.expires_at
     from job_matches m join job_snapshots s on s.id=m.job_snapshot_id
     where m.id=$1 and m.user_id=$2`, [id, userId],
  ))[0] ?? null;
}
