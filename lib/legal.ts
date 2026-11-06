import { createHash } from "crypto";
import { q, type TransactionQuery } from "./db";
import { trustedClientIp } from "./request-ip";
import { env } from "./env";
import { SUPPORT_EMAIL } from "./contact";

export const REQUIRED_LEGAL_DOCUMENT_KEYS = ["terms", "privacy"] as const;
export type RequiredLegalDocumentKey = (typeof REQUIRED_LEGAL_DOCUMENT_KEYS)[number];
export type LegalAcceptanceSurface = "email_signup" | "google_signup" | "legal_notice" | "settings" | "api";

export type LegalVersionSummary = {
  id: string;
  documentKey: RequiredLegalDocumentKey;
  title: string;
  versionNumber: number;
  changeSummary: string;
  materialChange: boolean;
  effectiveAt: string;
  publishedAt: string;
  contentDigest: string;
};

export type LegalVersionDetail = LegalVersionSummary & {
  bodyMarkdown: string;
  status: "scheduled" | "published" | "superseded";
};

export type PendingLegalAcceptance = LegalVersionSummary & {
  reason: "signup_missing" | "material_change";
};

type LegalVersionRow = {
  id: string;
  document_key: RequiredLegalDocumentKey;
  title: string;
  version_number: number;
  status: "scheduled" | "published" | "superseded";
  body_markdown: string;
  change_summary: string;
  material_change: boolean;
  effective_at: string;
  published_at: string;
  content_digest: string;
};

type CurrentLegalRow = LegalVersionRow & {
  acceptance_required_from: string;
};

const LOCAL_DEV_BODIES: Record<RequiredLegalDocumentKey, string> = {
  terms: "## Use of the service\n\nRoleSharp provides resume and job-search tools. Review generated content before use.\n\n## Accounts and limits\n\nDo not abuse automation or bypass account limits.\n\n## Changes\n\nMaterial changes require exact-version acceptance before high-impact actions.",
  privacy: "## Information we process\n\nRoleSharp processes account, resume, product, payment, support, and security data needed to provide and protect the service.\n\n## Your choices\n\nAccount, export, privacy, mailbox-disconnection, and deletion controls remain available as applicable.\n\n## Contact\n\nContact " + SUPPORT_EMAIL + " for privacy questions.",
};

const LOCAL_DEV_LEGAL_VERSIONS: LegalVersionSummary[] = [
  {
    id: "00000000-0000-4000-8000-000000000047",
    documentKey: "terms",
    title: "Terms of Service",
    versionNumber: 1,
    changeSummary: "Local-development legal baseline.",
    materialChange: false,
    effectiveAt: "2026-08-05T00:00:00.000Z",
    publishedAt: "2026-08-05T00:00:00.000Z",
    contentDigest: "0".repeat(64),
  },
  {
    id: "00000000-0000-4000-8000-000000000048",
    documentKey: "privacy",
    title: "Privacy Policy",
    versionNumber: 1,
    changeSummary: "Local-development privacy baseline.",
    materialChange: false,
    effectiveAt: "2026-08-05T00:00:00.000Z",
    publishedAt: "2026-08-05T00:00:00.000Z",
    contentDigest: "0".repeat(64),
  },
];

function summary(row: LegalVersionRow): LegalVersionSummary {
  return {
    id: row.id,
    documentKey: row.document_key,
    title: row.title,
    versionNumber: row.version_number,
    changeSummary: row.change_summary,
    materialChange: row.material_change,
    effectiveAt: row.effective_at,
    publishedAt: row.published_at,
    contentDigest: row.content_digest,
  };
}

function detail(row: LegalVersionRow): LegalVersionDetail {
  return { ...summary(row), bodyMarkdown: row.body_markdown, status: row.status };
}

function currentLegalQuery() {
  return `select distinct on (d.document_key)
      v.id,d.document_key,d.title,v.version_number,v.status,v.body_markdown,
      v.change_summary,v.material_change,v.effective_at,v.published_at,
      v.content_digest,d.acceptance_required_from
    from legal_documents d
    join legal_document_versions v on v.document_key=d.document_key
    where d.required_at_signup=true
      and v.status in ('scheduled','published')
      and v.effective_at<=now()
    order by d.document_key,v.effective_at desc,v.version_number desc`;
}

export async function currentRequiredLegalVersions(query: TransactionQuery = q): Promise<LegalVersionSummary[]> {
  if (env.localDevMode && query === q) return LOCAL_DEV_LEGAL_VERSIONS;
  const rows = await query<CurrentLegalRow>(currentLegalQuery());
  const byKey = new Map(rows.map((row) => [row.document_key, row]));
  return REQUIRED_LEGAL_DOCUMENT_KEYS.map((key) => byKey.get(key)).filter((row): row is CurrentLegalRow => Boolean(row)).map(summary);
}

export async function currentLegalDocument(
  documentKey: RequiredLegalDocumentKey,
  versionNumber?: number | null,
): Promise<LegalVersionDetail | null> {
  if (env.localDevMode && (!versionNumber || versionNumber === 1)) {
    const base = LOCAL_DEV_LEGAL_VERSIONS.find((version) => version.documentKey === documentKey);
    return base ? { ...base, bodyMarkdown: LOCAL_DEV_BODIES[documentKey], status: "published" } : null;
  }
  const row = (await q<LegalVersionRow>(
    `select v.id,d.document_key,d.title,v.version_number,v.status,v.body_markdown,
       v.change_summary,v.material_change,v.effective_at,v.published_at,v.content_digest
     from legal_documents d
     join legal_document_versions v on v.document_key=d.document_key
     where d.document_key=$1
       and v.status in ('scheduled','published','superseded')
       and v.effective_at<=now()
       and ($2::integer is null or v.version_number=$2)
     order by v.effective_at desc,v.version_number desc limit 1`,
    [documentKey, versionNumber ?? null],
  ))[0];
  return row ? detail(row) : null;
}

export async function legalDocumentHistory(documentKey: RequiredLegalDocumentKey, limit = 25): Promise<LegalVersionSummary[]> {
  if (env.localDevMode) return LOCAL_DEV_LEGAL_VERSIONS.filter((version) => version.documentKey === documentKey);
  const bounded = Math.max(1, Math.min(50, Math.trunc(limit)));
  const rows = await q<LegalVersionRow>(
    `select v.id,d.document_key,d.title,v.version_number,v.status,v.body_markdown,
       v.change_summary,v.material_change,v.effective_at,v.published_at,v.content_digest
     from legal_documents d
     join legal_document_versions v on v.document_key=d.document_key
     where d.document_key=$1 and v.status in ('scheduled','published','superseded')
       and v.effective_at<=now()
     order by v.effective_at desc,v.version_number desc limit $2`,
    [documentKey, bounded],
  );
  return rows.map(summary);
}

export async function pendingLegalAcceptances(userId: string, query: TransactionQuery = q): Promise<PendingLegalAcceptance[]> {
  const rows = await query<CurrentLegalRow & { user_created_at: string; accepted: boolean }>(
    `with current_versions as (${currentLegalQuery()})
     select c.*,u.created_at user_created_at,
       exists (
         select 1 from legal_acceptances a
         where a.user_id=u.id and a.legal_version_id=c.id
       ) accepted
     from current_versions c
     join users u on u.id=$1 and u.deleting_at is null
     order by c.document_key`,
    [userId],
  );
  return rows.flatMap((row) => {
    if (row.accepted) return [];
    const createdAfterAcceptanceLaunch = new Date(row.user_created_at).getTime() >= new Date(row.acceptance_required_from).getTime();
    if (!row.material_change && !createdAfterAcceptanceLaunch) return [];
    return [{
      ...summary(row),
      reason: row.material_change ? "material_change" as const : "signup_missing" as const,
    }];
  });
}

export class LegalAcceptanceRequiredError extends Error {
  readonly code = "legal_acceptance_required";
  constructor(readonly pending: PendingLegalAcceptance[]) {
    super("legal_acceptance_required");
  }
}

export async function requireCurrentLegalAcceptance(userId: string, query: TransactionQuery = q): Promise<void> {
  if (env.localDevMode) return;
  const pending = await pendingLegalAcceptances(userId, query);
  if (pending.length > 0) throw new LegalAcceptanceRequiredError(pending);
}

export function legalRequestEvidenceDigest(input: {
  headers: Pick<Headers, "get">;
  userId: string;
  versionIds: readonly string[];
  surface: LegalAcceptanceSurface;
}): string {
  const ip = trustedClientIp(input.headers);
  const userAgent = input.headers.get("user-agent")?.slice(0, 500) ?? "";
  const host = input.headers.get("host")?.toLowerCase().slice(0, 255) ?? "";
  return createHash("sha256").update(JSON.stringify({
    domain: "rolesharp-legal-acceptance-v1",
    userId: input.userId,
    versionIds: [...input.versionIds].sort(),
    surface: input.surface,
    ip,
    userAgent,
    host,
  })).digest("hex");
}

async function recordCurrentLegalAcceptances(input: {
  query: TransactionQuery;
  userId: string;
  versionIds: readonly string[];
  surface: LegalAcceptanceSurface;
  requestEvidenceDigest: string;
  requireAll: boolean;
}): Promise<LegalVersionSummary[]> {
  const uniqueIds = [...new Set(input.versionIds)];
  if (uniqueIds.length === 0) throw new Error("legal_acceptance_versions_required");
  const current = await currentRequiredLegalVersions(input.query);
  if (current.length !== REQUIRED_LEGAL_DOCUMENT_KEYS.length) throw new Error("legal_versions_unavailable");
  const expected = new Set(current.map((version) => version.id));
  if (input.requireAll && uniqueIds.length !== current.length) throw new Error("legal_acceptance_versions_required");
  if (uniqueIds.some((id) => !expected.has(id))) throw new Error("legal_version_not_current");

  const selected = current.filter((version) => uniqueIds.includes(version.id));
  for (const version of selected) {
    await input.query(
      `insert into legal_acceptances
         (user_id,document_key,legal_version_id,version_number,content_digest_snapshot,
          acceptance_surface,request_evidence_digest)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (user_id,legal_version_id) do nothing`,
      [
        input.userId,
        version.documentKey,
        version.id,
        version.versionNumber,
        version.contentDigest,
        input.surface,
        input.requestEvidenceDigest,
      ],
    );
  }
  return selected;
}

export async function recordExactLegalAcceptances(input: {
  query: TransactionQuery;
  userId: string;
  versionIds: readonly string[];
  surface: LegalAcceptanceSurface;
  requestEvidenceDigest: string;
}): Promise<LegalVersionSummary[]> {
  return recordCurrentLegalAcceptances({ ...input, requireAll: true });
}

export async function recordPendingLegalAcceptances(input: {
  query: TransactionQuery;
  userId: string;
  versionIds: readonly string[];
  surface: Extract<LegalAcceptanceSurface, "legal_notice" | "settings" | "api">;
  requestEvidenceDigest: string;
}): Promise<LegalVersionSummary[]> {
  const pending = await pendingLegalAcceptances(input.userId, input.query);
  const pendingIds = new Set(pending.map((version) => version.id));
  if (input.versionIds.some((id) => !pendingIds.has(id))) throw new Error("legal_version_not_pending");
  return recordCurrentLegalAcceptances({ ...input, requireAll: false });
}
