import { createHash, randomUUID } from "node:crypto";
import { q, withTransaction } from "../db";
import { activeFeatureAccessInTransaction } from "../feature-access";
import { renderResumePdf } from "../pdf";
import { ResumeContent } from "../types";
import { normalizeSkillText } from "../job-match/normalization";
import { canonicalHash } from "./canonical-json";
import { workflowFlagEnabled } from "./flags";
import { enqueueMailboxAttempt } from "./queues";
import { currentRequiredLegalVersions, REQUIRED_LEGAL_DOCUMENT_KEYS, requireCurrentLegalAcceptance } from "../legal";

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeHeader(value: string, max: number): string {
  const result = value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
  if (!result) throw new Error("invalid_message_header");
  return result;
}

function filename(value: string): string {
  return `${value.normalize("NFKC").replace(/[^A-Za-z0-9._-]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 140) || "RoleSharp"}_resume.pdf`;
}

export function tailorResumeContent(content: ResumeContent, jobFacts: {
  skillRequirements?: { text?: string; kind?: string }[];
}): ResumeContent {
  const wanted = new Set((jobFacts.skillRequirements ?? [])
    .filter((item) => item.kind !== "negated" && typeof item.text === "string")
    .flatMap((item) => normalizeSkillText(item.text ?? "")));
  const relevance = (value: string) => normalizeSkillText(value)
    .reduce((score, skill) => score + (wanted.has(skill) ? 1 : 0), 0);
  const stableRelevantFirst = <T>(items: readonly T[], text: (item: T) => string) => items
    .map((item, index) => ({ item, index, score: relevance(text(item)) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
  return {
    ...content,
    skills: stableRelevantFirst(content.skills, (skill) => skill),
    experiences: content.experiences.map((experience) => ({
      ...experience,
      bullets: stableRelevantFirst(experience.bullets, (bullet) => bullet),
    })),
    projects: stableRelevantFirst(content.projects, (project) => `${project.name} ${project.detail}`),
  };
}

export async function prepareApplicationPackage(
  matchId: string,
  unusedEnqueue?: (payload: { attemptId: string; version: 1 }) => Promise<unknown>,
): Promise<{ packageId: string | null }> {
  void unusedEnqueue;
  if (!(await workflowFlagEnabled("role_apply_prepare"))) return { packageId: null };
  const source = (await q<any>(
    `select m.*,c.authorization_mode,c.consent_version,c.consent_expires_at,c.pinned_connection_id,
       c.status campaign_status,s.facts,s.source_url,s.source_body_hash,j.title job_title,j.company,
       e.connection_generation,e.status connection_status,
       r.id resume_id,r.content,r.template,r.candidate_name,r.premium_unlock
     from job_matches m
     join job_campaigns c on c.id=m.campaign_id and c.user_id=m.user_id
     join job_snapshots s on s.id=m.job_snapshot_id
     join jobs j on j.provider=s.provider_namespace and j.external_id=s.provider_job_id
     join email_connections e on e.id=c.pinned_connection_id and e.user_id=m.user_id
     join lateral (
       select * from resumes where user_id_text=m.user_id::text or user_id=m.user_id
       order by created_at desc,id desc limit 1
     ) r on true
     where m.id=$1 and m.status='eligible' and c.mode='role_apply' and c.status='active'
       and workflow_rollout_allows('role_apply_prepare',m.user_id)`, [matchId],
  ))[0];
  if (!source || source.connection_status !== "active") return { packageId: null };
  const extractedRecipient = source.facts?.recipient?.record;
  const candidates = Array.isArray(extractedRecipient?.candidates) ? extractedRecipient.candidates : [];
  const employerDomain = extractedRecipient?.employerDomainRelationship;
  const hasSafeRecipient = candidates.some((candidate: { email?: unknown; warnings?: unknown }) =>
    typeof candidate.email === "string"
      && Array.isArray(candidate.warnings)
      && candidate.warnings.length === 0);
  if (!extractedRecipient || extractedRecipient.disposition !== "auto_eligible"
    || candidates.length < 1 || source.facts?.recipient?.recipient !== "source_backed"
    || source.facts?.recipient?.emailInstruction !== "explicit"
    || typeof employerDomain !== "string" || employerDomain === "unavailable"
    || !hasSafeRecipient) return { packageId: null };
  const recipient = { ...extractedRecipient, jobSnapshotId: source.job_snapshot_id };
  const content = ResumeContent.safeParse(source.content);
  if (!content.success) throw new Error("resume_invalid");
  const tailoredContent = tailorResumeContent(content.data, source.facts ?? {});
  const candidateName = String(source.candidate_name || content.data.headline || "Candidate");
  const pdf = await renderResumePdf(tailoredContent, candidateName, {
    template: source.template || "basic", watermark: false,
  });
  const bytes = Buffer.from(pdf);
  if (bytes.length > 10 * 1024 * 1024) throw new Error("attachment_too_large");
  const attachmentBytesHash = sha256(bytes);
  const attachmentHash = canonicalHash({ resumeId: source.resume_id, content: tailoredContent, template: source.template || "basic" });
  const subject = safeHeader(`Application for ${source.job_title}`, 200);
  const body = `Dear Hiring Team,\n\nI am applying for the ${safeHeader(source.job_title, 160)} role at ${safeHeader(source.company, 160)}. Please find my resume attached for your review.\n\nKind regards,\n${safeHeader(candidateName, 160)}`;
  const packageId = randomUUID();
  const sendScoreEligible = source.fit_score >= 85 && source.confidence_score >= 80;
  const saved = await withTransaction(async (query) => {
    await requireCurrentLegalAcceptance(source.user_id, query);
    await activeFeatureAccessInTransaction(query, source.user_id, "role_apply_prepare");
    const legalVersionSnapshot = (await currentRequiredLegalVersions(query)).map((version) => ({
      documentKey: version.documentKey,
      id: version.id,
      versionNumber: version.versionNumber,
      contentDigest: version.contentDigest,
    })).sort((left, right) => left.documentKey.localeCompare(right.documentKey, "en"));
    if (legalVersionSnapshot.length !== REQUIRED_LEGAL_DOCUMENT_KEYS.length) {
      throw new Error("legal_versions_unavailable");
    }
    const packageHash = canonicalHash({
      recipient, subject, body, attachmentHash, attachmentBytesHash,
      sourceBodyHashSnapshot: source.source_body_hash, sourceUrlSnapshot: source.source_url,
      legalVersionSnapshot, profileVersionId: source.profile_version_id,
      connectionId: source.pinned_connection_id, connectionGeneration: source.connection_generation,
      templateVersion: 1, policyVersion: 1, scoreVersion: 1, extractionVersion: 1,
    });
    const current = (await query<any>(
      `select m.id,s.source_body_hash,s.source_url,s.facts from job_matches m
       join job_campaigns c on c.id=m.campaign_id
       join email_connections e on e.id=c.pinned_connection_id
       join job_snapshots s on s.id=m.job_snapshot_id
       where m.id=$1 and m.user_id=$2 and m.status='eligible' and c.status='active'
         and e.status='active' for update of m,c,e`, [matchId, source.user_id],
    ))[0];
    if (!current
      || current.source_body_hash !== source.source_body_hash
      || current.source_url !== source.source_url
      || canonicalHash(current.facts?.recipient ?? null) !== canonicalHash(source.facts?.recipient ?? null)) {
      return null;
    }
    const inserted = (await query<{ id: string }>(
      `insert into application_packages(id,user_id,canonical_job_key,canonical_company_key,
         job_snapshot_id,profile_version_id,resume_id,template_version,policy_version,score_version,
         extraction_version,connection_id,connection_generation,recipient_record,subject,body,
         attachment_hash,attachment_bytes_hash,source_body_hash_snapshot,source_url_snapshot,
         legal_version_snapshot,package_hash,status)
       values($1,$2,$3,$4,$5,$6,$7,1,1,1,1,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       on conflict(package_hash) do nothing returning id`,
      [packageId, source.user_id, source.canonical_job_key, source.canonical_company_key,
        source.job_snapshot_id, source.profile_version_id, source.resume_id, source.pinned_connection_id,
        source.connection_generation, recipient, subject, body, attachmentHash, attachmentBytesHash,
        // JSON.stringify, not the bare array: node-postgres renders a JS array as a
        // Postgres array literal ({...}), which jsonb rejects with "invalid input
        // syntax for type json". Plain objects (recipient above) are serialised as
        // JSON automatically -- arrays are the exception.
        source.source_body_hash, source.source_url, JSON.stringify(legalVersionSnapshot), packageHash,
        !sendScoreEligible ? "blocked" : "review_required"],
    ))[0];
    const id = inserted?.id ?? (await query<{ id: string }>(
      "select id from application_packages where package_hash=$1 and user_id=$2", [packageHash, source.user_id],
    ))[0]?.id;
    if (!id) return null;
    await query(
      `insert into application_package_attachments(package_id,user_id,bytes,bytes_hash,filename)
       values($1,$2,$3,$4,$5) on conflict(package_id) do nothing`,
      [id, source.user_id, bytes, attachmentBytesHash, filename(candidateName)],
    );
    return { packageId: id };
  });
  return saved ?? { packageId: null };
}

export async function approveApplicationPackages(userId: string, approvals: readonly {
  packageId: string; selectedRecipient: string;
}[], enqueue: (payload: { attemptId: string; version: 1 }) => Promise<unknown> = enqueueMailboxAttempt,
now = new Date()) {
  if (approvals.length < 1 || approvals.length > 5
    || new Set(approvals.map((item) => item.packageId)).size !== approvals.length) {
    throw new Error("approval_batch_limit");
  }
  const attemptIds = await withTransaction(async (query) => {
    await requireCurrentLegalAcceptance(userId, query);
    await activeFeatureAccessInTransaction(query, userId, "role_apply_prepare");
    const ids: string[] = [];
    for (const item of approvals) {
      const row = (await query<any>(
        `select p.*,c.id campaign_id,c.authorization_mode,c.status campaign_status,m.fit_score,
            m.confidence_score,m.blockers,e.status connection_status,
            existing.id existing_attempt_id,existing.package_id existing_package_id,
            existing.status existing_attempt_status,existing.current_invocation_ordinal,
            existing_approval.id existing_approval_id,
            existing_approval.status existing_approval_status,
            (existing_approval.expires_at<=now()) approval_expired
          from application_packages p
          join job_campaigns c on c.user_id=p.user_id and c.mode='role_apply' and c.status='active'
            and c.profile_version_id=p.profile_version_id and c.pinned_connection_id=p.connection_id
          join job_matches m on m.campaign_id=c.id and m.canonical_job_key=p.canonical_job_key
            and m.job_snapshot_id=p.job_snapshot_id
          join email_connections e on e.id=p.connection_id and e.user_id=p.user_id
          left join application_mail_attempts existing on existing.user_id=p.user_id
            and existing.canonical_job_key=p.canonical_job_key
          left join package_approvals existing_approval on existing_approval.id=existing.approval_id
          where p.id=$1 and p.user_id=$2 and p.status in ('review_required','ready')
          for update of p,c,m,e`,
         [item.packageId, userId],
       ))[0];
      const renewingExpiredApproval = row?.status === "ready"
        && row.existing_package_id === row.id
        && row.approval_expired === true
        && ["queued", "needs_user"].includes(row.existing_attempt_status)
        && Number(row.current_invocation_ordinal) === 0;
      if (!row || (row.status !== "review_required" && !renewingExpiredApproval)
        || (row.status === "review_required" && row.existing_attempt_id)
        || row.connection_status !== "active" || row.campaign_status !== "active"
         || row.fit_score < 85 || row.confidence_score < 80 || row.blockers.length > 0) {
        throw new Error("package_not_approvable");
      }
      const allowedRecipients = Array.isArray(row.recipient_record?.candidates)
        ? row.recipient_record.candidates.filter((candidate: { email?: unknown; warnings?: unknown }) =>
          typeof candidate.email === "string"
            && Array.isArray(candidate.warnings)
            && candidate.warnings.length === 0)
          .map((candidate: { email: string }) => candidate.email) : [];
      const recipient = item.selectedRecipient.trim().toLocaleLowerCase("en");
      const employerDomain = row.recipient_record?.employerDomainRelationship;
      if (row.authorization_mode !== "review_each"
        || row.recipient_record?.disposition !== "auto_eligible"
        || typeof employerDomain !== "string"
        || employerDomain === "unavailable"
        || !allowedRecipients.includes(recipient)) {
        throw new Error("recipient_not_source_backed");
      }
      if (renewingExpiredApproval) {
        const renewable = (await query<{ approval_id: string }>(
          `select a.approval_id from application_mail_attempts a
           join package_approvals pa on pa.id=a.approval_id and pa.user_id=a.user_id
           where a.id=$1 and a.status in ('queued','needs_user') and a.current_invocation_ordinal=0
             and pa.expires_at<=now() for update of a,pa`,
          [row.existing_attempt_id],
        ))[0];
        if (!renewable) throw new Error("package_not_approvable");
        await query(
          "update package_approvals set status='expired' where id=$1 and status='active' and expires_at<=now()",
          [renewable.approval_id],
        );
        await query(
          `update application_mail_attempts set status='needs_user',updated_at=now()
           where id=$1 and status='queued' and current_invocation_ordinal=0`,
          [row.existing_attempt_id],
        );
      } else {
        await query("update application_packages set status='ready',updated_at=now() where id=$1", [row.id]);
      }
      const approval = (await query<{ id: string }>(
        `insert into package_approvals(user_id,package_id,package_hash,authorization_mode,actor,
            campaign_id,selected_recipient,approved_at,expires_at)
          values($1,$2,$3,'review_each','user',$4,$5,$6,$7) returning id`,
        [userId, row.id, row.package_hash, row.campaign_id, recipient,
          now, new Date(now.getTime() + 24 * 3600_000)],
      ))[0];
      const attempt = renewingExpiredApproval
        ? (await query<{ id: string }>(
          `update application_mail_attempts set approval_id=$2,campaign_id=$3,connection_id=$4,
             status='queued',updated_at=now()
           where id=$1 and status='needs_user' and current_invocation_ordinal=0 returning id`,
          [row.existing_attempt_id, approval.id, row.campaign_id, row.connection_id],
        ))[0]
        : (await query<{ id: string }>(
          `insert into application_mail_attempts(user_id,canonical_job_key,canonical_company_key,
             package_id,approval_id,campaign_id,connection_id,status)
           values($1,$2,$3,$4,$5,$6,$7,'queued')
           on conflict(user_id,canonical_job_key) do nothing returning id`,
          [userId, row.canonical_job_key, row.canonical_company_key, row.id, approval.id,
            row.campaign_id, row.connection_id],
        ))[0];
      // A concurrent approval for a replacement package can win the
      // one-attempt-per-user-and-job constraint after the preflight join. Do
      // not commit an orphan approval or report success when no attempt was
      // actually attached to this exact package.
      if (!attempt) throw new Error("package_not_approvable");
      ids.push(attempt.id);
    }
    return ids;
  });
  await Promise.all(attemptIds.map(async (attemptId) => {
    await enqueue({ attemptId, version: 1 }).catch((error) => {
      console.error("[application-package] approval enqueue failed; scheduler will reconcile", {
        attemptId,
        error: error instanceof Error ? error.name : "unknown_error",
      });
    });
  }));
  return { approved: approvals.length, queued: attemptIds.length };
}

export async function reviseApplicationPackage(input: {
  userId: string; packageId: string; subject?: string; body?: string;
}) {
  return withTransaction(async (query) => {
    const row = (await query<any>(
      `select p.*,a.bytes,a.bytes_hash,a.filename from application_packages p
       join application_package_attachments a on a.package_id=p.id and a.user_id=p.user_id
       where p.id=$1 and p.user_id=$2 and p.status in ('review_required','ready') for update of p`,
      [input.packageId, input.userId],
    ))[0];
    if (!row) return null;
    const subject = safeHeader(input.subject ?? row.subject, 200);
    const body = (input.body ?? row.body).replace(/\0/gu, "").trim().slice(0, 10_000);
    if (!body) throw new Error("invalid_message_body");
    const id = randomUUID();
    await requireCurrentLegalAcceptance(input.userId, query);
    await activeFeatureAccessInTransaction(query, input.userId, "role_apply_prepare");
    const legalVersionSnapshot = (await currentRequiredLegalVersions(query)).map((version) => ({
      documentKey: version.documentKey,
      id: version.id,
      versionNumber: version.versionNumber,
      contentDigest: version.contentDigest,
    })).sort((left, right) => left.documentKey.localeCompare(right.documentKey, "en"));
    if (legalVersionSnapshot.length !== REQUIRED_LEGAL_DOCUMENT_KEYS.length) {
      throw new Error("legal_versions_unavailable");
    }
    const packageHash = canonicalHash({
      recipient: row.recipient_record, subject, body, attachmentHash: row.attachment_hash,
      attachmentBytesHash: row.attachment_bytes_hash,
      sourceBodyHashSnapshot: row.source_body_hash_snapshot,
      sourceUrlSnapshot: row.source_url_snapshot, legalVersionSnapshot,
      profileVersionId: row.profile_version_id, connectionId: row.connection_id,
      connectionGeneration: row.connection_generation, templateVersion: row.template_version,
      policyVersion: row.policy_version, scoreVersion: row.score_version,
      extractionVersion: row.extraction_version,
    });
    await query("update application_packages set status='stale',updated_at=now() where id=$1", [row.id]);
    await query("update package_approvals set status='invalidated',invalidated_at=now() where package_id=$1 and status='active'", [row.id]);
    await query(
      `insert into application_packages(id,user_id,canonical_job_key,canonical_company_key,
         job_snapshot_id,profile_version_id,resume_id,template_version,policy_version,score_version,
         extraction_version,connection_id,connection_generation,recipient_record,subject,body,
         attachment_hash,attachment_bytes_hash,source_body_hash_snapshot,source_url_snapshot,
         legal_version_snapshot,package_hash,status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'review_required')`,
      [id, row.user_id, row.canonical_job_key, row.canonical_company_key, row.job_snapshot_id,
        row.profile_version_id, row.resume_id, row.template_version, row.policy_version,
        row.score_version, row.extraction_version, row.connection_id, row.connection_generation,
        row.recipient_record, subject, body, row.attachment_hash, row.attachment_bytes_hash,
        row.source_body_hash_snapshot, row.source_url_snapshot, JSON.stringify(legalVersionSnapshot), packageHash],
    );
    await query(
      `insert into application_package_attachments(package_id,user_id,bytes,bytes_hash,filename)
       values($1,$2,$3,$4,$5)`, [id, input.userId, row.bytes, row.bytes_hash, row.filename],
    );
    return { id, status: "review_required" };
  });
}

export async function listApplicationPackages(userId: string, limit = 50) {
  return q(
    `select p.id,p.canonical_job_key,p.recipient_record,p.subject,p.body,p.package_hash,p.status,
       p.created_at,p.updated_at,m.fit_score,m.confidence_score,m.blockers,s.source_url
     from application_packages p
     join job_snapshots s on s.id=p.job_snapshot_id
     left join lateral (
       select fit_score,confidence_score,blockers from job_matches
       where user_id=p.user_id and canonical_job_key=p.canonical_job_key
       order by created_at desc limit 1
     ) m on true
     where p.user_id=$1 order by p.created_at desc limit $2`, [userId, Math.max(1, Math.min(limit, 100))],
  );
}

export async function getApplicationPackage(userId: string, packageId: string) {
  return (await q(
    `select p.id,p.canonical_job_key,p.recipient_record,p.subject,p.body,p.package_hash,p.status,
       p.attachment_hash,p.attachment_bytes_hash,a.filename,a.media_type,p.created_at,p.updated_at
     from application_packages p join application_package_attachments a on a.package_id=p.id
     where p.id=$1 and p.user_id=$2`, [packageId, userId],
  ))[0] ?? null;
}
