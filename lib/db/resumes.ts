import { env } from "../env";
import { getCompanyBySlug } from "./companies";
import { hasDb, q, withTransaction } from "./core";
import { getRoleBySlug } from "./roles";

export async function saveResume(resume: {
  id: string;
  companySlug?: string;
  companyId?: number | null;
  roleSlug?: string;
  roleId?: number | null;
  jdText?: string;
  content: unknown;
  atsScore: number;
  name: string;
  genMs: number;
  userId?: string | null;
  template?: string;
  premiumUnlock?: boolean;
  creditEventId?: number | null;
  model?: string;
}) {
  if (!hasDb()) throw new Error("Database is not configured");
  const company = resume.companyId !== undefined
    ? resume.companyId
    : resume.companySlug
      ? (await getCompanyBySlug(resume.companySlug))?.id ?? null
      : null;
  const role = resume.roleId !== undefined
    ? resume.roleId
    : resume.roleSlug
      ? (await getRoleBySlug(resume.roleSlug))?.id ?? null
      : null;
  return withTransaction(async (query) => {
    if (resume.userId) {
      const owner = await query<{ id: string }>(
        "select id from users where id=$1 for key share",
        [resume.userId],
      );
      if (!owner[0]) return false;
    }
    const saved = await query<{ id: string }>(
      `insert into resumes (id, company_id, role_id, jd_text, content, ats_score, model, gen_ms, user_id_text, user_id, template, candidate_name, premium_unlock, credit_event_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text,$9::uuid,$10,$11,$12,$13)
       on conflict (id) do update set
         content=excluded.content,
         ats_score=excluded.ats_score,
         gen_ms=excluded.gen_ms,
         template=excluded.template,
         candidate_name=excluded.candidate_name,
         premium_unlock=excluded.premium_unlock,
         credit_event_id=excluded.credit_event_id,
         model=excluded.model
       where resumes.user_id is not distinct from excluded.user_id
         and resumes.user_id_text is not distinct from excluded.user_id_text
       returning id`,
      [
        resume.id,
        company,
        role,
        resume.jdText ?? null,
        JSON.stringify(resume.content),
        resume.atsScore,
        resume.model ?? env.llmModel,
        resume.genMs,
        resume.userId ?? null,
        resume.template ?? "basic",
        resume.name,
        Boolean(resume.premiumUnlock),
        resume.creditEventId ?? null,
      ],
    );
    return Boolean(saved[0]);
  });
}

export async function listUserResumes(userId: string, limit = 50) {
  return q(
    `select r.id, r.candidate_name, r.ats_score, r.template, r.premium_unlock, r.created_at,
            r.content->>'headline' as headline,
            c.name as company_name, ro.title as role_title
     from resumes r
     left join companies c on c.id = r.company_id
     left join roles ro on ro.id = r.role_id
     where r.user_id_text=$1 or r.user_id=$1::uuid order by r.created_at desc limit $2`,
    [userId, limit],
  );
}

export async function getResume(id: string) {
  const rows = await q("select * from resumes where id=$1", [id]);
  return rows[0] ?? null;
}

// A permanently failed BullMQ generation writes status='failed' into
// action_idempotency (worker's failed handler) but never inserts a resumes
// row — so a GET for that id 404s forever. Callers need to distinguish
// "still generating" from "dead, stop polling".
export async function getFailedGeneration(resumeId: string) {
  const rows = await q<{ status: string }>(
    "select status from action_idempotency where action_kind='generate' and response->>'resumeId'=$1",
    [resumeId],
  );
  return rows[0]?.status ?? null;
}

export async function getUserResume(id: string, userId: string) {
  const rows = await q("select * from resumes where id=$1 and (user_id_text=$2 or user_id=$2::uuid)", [id, userId]);
  return rows[0] ?? null;
}

export async function deleteUserResume(id: string, userId: string) {
  if (!hasDb()) return false;
  return withTransaction(async (query) => {
    const owned = await query<{ id: string }>(
      `select id from resumes
       where id=$1 and (user_id_text=$2 or user_id=$2::uuid)
       for update`,
      [id, userId],
    );
    if (!owned[0]) return false;
    const deleted = await query<{ id: string }>(
      `delete from resumes
       where id=$1 and (user_id_text=$2 or user_id=$2::uuid)
       returning id`,
      [id, userId],
    );
    return Boolean(deleted[0]);
  });
}

// Rename is a display concern only — the card label, not the generated content.
export async function renameUserResume(id: string, userId: string, name: string) {
  if (!hasDb()) return false;
  const clean = name.trim().slice(0, 120);
  if (!clean) return false;
  const updated = await q<{ id: string }>(
    `update resumes set candidate_name=$3
     where id=$1 and (user_id_text=$2 or user_id=$2::uuid)
     returning id`,
    [id, userId, clean],
  );
  return Boolean(updated[0]);
}

// Copy every column that shapes the resume, with a fresh id. This is the
// deliberate versioning primitive: tailor for 5 jobs, fork the one that scored
// best, edit the fork. created_at stamps the fork as its own resume.
export async function duplicateUserResume(id: string, userId: string, newId: string) {
  if (!hasDb()) return null;
  return withTransaction(async (query) => {
    const source = await query<{ id: string }>(
      `select id from resumes
       where id=$1 and (user_id_text=$2 or user_id=$2::uuid)
       for update`,
      [id, userId],
    );
    if (!source[0]) return null;
    const created = await query<{ id: string }>(
      `insert into resumes
         (id, company_id, role_id, jd_text, content, ats_score, model, gen_ms,
          user_id_text, user_id, template, candidate_name, premium_unlock,
          cover_letter, linkedin, interview)
       select $3, company_id, role_id, jd_text, content, ats_score, model, gen_ms,
          user_id_text, user_id, template, candidate_name, premium_unlock,
          cover_letter, linkedin, interview
       from resumes where id=$1
       returning id`,
      [id, userId, newId],
    );
    return created[0]?.id ?? null;
  });
}

export async function deleteResumeAsAdmin(id: string) {
  if (!hasDb()) return null;
  return withTransaction(async (query) => {
    const resume = (await query<{
      id: string;
      candidate_name: string | null;
      user_id_text: string | null;
    }>(
      "select id, candidate_name, user_id_text from resumes where id::text=$1 for update",
      [id],
    ))[0];
    if (!resume) return null;
    await query("delete from resumes where id=$1", [resume.id]);
    await query(
      `insert into admin_actions (action, target_user_id, target_email, details)
       values ($1,$2,$3,$4)`,
      ["resume_delete", resume.user_id_text, null, JSON.stringify({
        resumeId: resume.id,
        candidate: resume.candidate_name,
      })],
    );
    return resume;
  });
}

export async function markPaid(id: string) {
  await q("update resumes set paid=true, paid_at=now() where id=$1", [id]);
}
