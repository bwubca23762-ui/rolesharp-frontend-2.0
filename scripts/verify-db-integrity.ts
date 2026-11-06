import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

// SIZE_OK: this destructive, opt-in DB harness intentionally keeps its synthetic
// fixture and transactional assertions together so it cannot be imported by the
// application or accidentally run against a separately configured database.
class IntegrityConfigurationError extends Error {
  readonly name = "IntegrityConfigurationError";
}

if (process.env.DB_INTEGRITY_TEST !== "true") {
  throw new IntegrityConfigurationError(
    "DB_INTEGRITY_TEST=true is required; refusing to reset a database",
  );
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new IntegrityConfigurationError("DATABASE_URL is required");
}

const client = new Client({ connectionString: databaseUrl });
const migrationsDirectory = resolve("db/migrations");
const INTEGRITY_APPROVER_ID = "4a000000-0000-4000-8000-000000000001";

async function migrationNames(): Promise<readonly string[]> {
  return (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
}

async function applyMigration(name: string): Promise<void> {
  const source = await readFile(resolve(migrationsDirectory, name), "utf8");
  // CREATE INDEX CONCURRENTLY cannot run inside the implicit transaction that a
  // multi-statement client.query() opens, so the harness builds those indexes
  // plainly — the same index results, and the only thing CONCURRENTLY buys is
  // not locking live traffic, which a throwaway test database does not have.
  //
  // This keyed off the literal filename "028_role_search_index.sql" and used
  // String.replace, which rewrites only the first match. Both assumptions broke
  // the moment a second such migration existed or one of them declared more
  // than one index. Key off the marker the file itself carries, and replace all.
  await client.query(source.includes("NON_TRANSACTIONAL")
    ? source.replaceAll("index concurrently", "index")
    : source);
}

async function resetDatabase(legacy: boolean): Promise<void> {
  await client.query("drop schema public cascade; create schema public");
  const schemaSource = await readFile(resolve("db/schema.sql"), "utf8");
  const schema = process.env.DB_INTEGRITY_NO_VECTOR === "true"
    ? schemaSource
      .replace("create extension if not exists vector;", "")
      .replaceAll("vector(1536)", "text")
      .replace(/create index companies_embed_hnsw[\s\S]*?where embedding is not null;/, "")
      .replace(/create index roles_embed_hnsw[^;]+;/, "")
      .replace(/create or replace function match_roles[\s\S]*?\$\$;/, "")
    : schemaSource;
  await client.query(schema);
  const names = await migrationNames();
  for (const name of names.filter((candidate) => candidate < "030_")) {
    await applyMigration(name);
  }
  if (legacy) {
    await client.query(await readFile(resolve("tests/fixtures/legacy-applications.sql"), "utf8"));
  }
  for (const name of names.filter((candidate) => candidate >= "030_")) {
    await applyMigration(name);
  }
}

async function schemaDigest(): Promise<string> {
  const result = await client.query<{ definition: string }>(`
    select concat_ws('|', c.relkind, n.nspname, c.relname,
      coalesce(pg_get_viewdef(c.oid, true), ''),
      coalesce((select string_agg(pg_get_constraintdef(x.oid, true), ',' order by x.conname)
        from pg_constraint x where x.conrelid=c.oid), '')) definition
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','i','S')
    union all
    select concat_ws('|', 'column', table_name, ordinal_position, column_name,
      data_type, udt_name, is_nullable, coalesce(column_default, ''),
      is_generated, coalesce(generation_expression, ''))
    from information_schema.columns where table_schema='public'
    union all
    select 'index|' || pg_get_indexdef(i.indexrelid)
    from pg_index i
    join pg_class c on c.oid=i.indexrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    union all
    select 'function|' || p.oid::regprocedure::text || '|' || pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind <> 'a'
    union all
    select 'trigger|' || event_object_table || '|' || trigger_name || '|' ||
      action_timing || '|' || event_manipulation || '|' || action_statement
    from information_schema.triggers where trigger_schema='public'
    order by definition`);
  return createHash("sha256").update(result.rows.map(({ definition }) => definition).join("\n")).digest("hex");
}

async function expectSqlState(sql: string, code: string): Promise<void> {
  await assert.rejects(client.query(sql), (error: unknown) =>
    error instanceof Error && "code" in error && error.code === code);
}

const attemptStates = [
  "queued", "blocked", "canceled", "reserved", "sending",
  "provider_accepted", "unknown", "needs_user", "retryable", "terminal_failed",
] as const;
type AttemptState = (typeof attemptStates)[number];

const legalAttemptEdges = new Set([
  "queued>blocked", "queued>canceled", "queued>reserved", "queued>needs_user",
  "reserved>blocked", "reserved>canceled", "reserved>sending",
  "sending>provider_accepted", "sending>unknown", "sending>needs_user",
  "sending>retryable", "sending>terminal_failed",
  "retryable>reserved", "retryable>terminal_failed", "retryable>blocked",
  "retryable>canceled", "needs_user>queued", "needs_user>canceled",
]);

function attemptStatusUpdate(state: AttemptState): string {
  const terminal = ["blocked", "canceled", "provider_accepted", "unknown", "terminal_failed"].includes(state);
  const sending = state === "sending";
  return `update application_mail_attempts set status='${state}',
    provider_call_started_at=${sending ? "now()" : "null"},
    provider_acceptance_hash=${state === "provider_accepted" ? "repeat('f',64)" : "null"},
    terminal_at=${terminal ? "now()" : "null"}
    where id='49000000-0000-4000-8000-000000000001'`;
}

async function prepareAttemptState(testClient: Client, state: AttemptState): Promise<void> {
  if (state === "queued") return;
  if (state === "blocked" || state === "canceled" || state === "reserved") {
    await testClient.query(attemptStatusUpdate(state));
    return;
  }
  await testClient.query(attemptStatusUpdate("reserved"));
  await testClient.query(
    `select start_application_mail_invocation('49000000-0000-4000-8000-000000000001')`,
  );
  if (state !== "sending") {
    await testClient.query(attemptStatusUpdate(state));
  }
}

async function verifyAttemptTransitionGraph(): Promise<void> {
  const transitionClient = new Client({ connectionString: databaseUrl });
  await transitionClient.connect();
  try {
    for (const source of attemptStates) {
      for (const target of attemptStates) {
        if (source === target) continue;
        await transitionClient.query("begin");
        try {
          await prepareAttemptState(transitionClient, source);
          const edge = `${source}>${target}`;
          if (legalAttemptEdges.has(edge)) {
            await transitionClient.query(
              edge === "reserved>sending"
                ? `select start_application_mail_invocation('49000000-0000-4000-8000-000000000001')`
                : attemptStatusUpdate(target),
            );
          } else {
            await assert.rejects(
              transitionClient.query(attemptStatusUpdate(target)),
              (error: unknown) => error instanceof Error && "code" in error && error.code === "23514",
              `illegal attempt edge accepted: ${edge}`,
            );
          }
        } finally {
          await transitionClient.query("rollback");
        }
      }
    }
  } finally {
    await transitionClient.end();
  }
}

async function createUser(email: string, credits = 0): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into users (email,password_hash,email_verified_at,credits)
     values ($1,'test-only',now(),$2) returning id`,
    [email, credits],
  );
  assert.ok(result.rows[0]);
  const userId = result.rows[0].id;
  // Every user this harness creates is newer than acceptance_required_from, so
  // the service layer (requireCurrentLegalAcceptance) rejects it without a row
  // here. Accepting on creation keeps that gate real for the product while
  // letting each caller exercise the behaviour it actually tests.
  await client.query(
    `insert into legal_acceptances(user_id,document_key,legal_version_id,version_number,content_digest_snapshot,acceptance_surface,request_evidence_digest)
     select $1, legal.document_key, legal.id, legal.version_number, legal.content_digest, 'email_signup', repeat('a',64)
     from (
       select distinct on (document.document_key)
         document.document_key, version.id, version.version_number, version.content_digest
       from legal_documents document
       join legal_document_versions version on version.document_key = document.document_key
       where document.required_at_signup = true
         and version.status in ('scheduled', 'published')
         and version.effective_at <= now()
       order by document.document_key, version.effective_at desc, version.version_number desc
     ) legal`,
    [userId],
  );
  // Per-user feature access is a second gate, independent of feature_flags. An
  // approved grant requires a named staff approver by table constraint, so the
  // harness seeds one rather than inserting a headless approved row. Caps stay
  // null: daily_cap tops out at 5 and campaigns here ask for 10.
  await client.query(
    `insert into staff_accounts(id,email,display_name,status,activated_at)
     values ($1,'integrity-approver@example.test','Integrity Approver','active',now())
     on conflict (id) do nothing`,
    [INTEGRITY_APPROVER_ID],
  );
  await client.query(
    `insert into feature_access_grants(user_id,feature_key,state,approved_at,approved_by)
     select $1, feature.key, 'approved', now(), $2
     from (values ('daily_matches'),('role_apply_prepare'),('role_apply_gmail'),('role_apply_microsoft')) feature(key)`,
    [userId, INTEGRITY_APPROVER_ID],
  );
  return userId;
}

async function verifyDeletionSerialization(): Promise<void> {
  const { deleteUserAccountData, saveResume } = await import("../lib/db");
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const userId = await createUser(`delete-${iteration}@example.test`);
    const resumeId = randomUUID();
    await Promise.all([
      saveResume({
        id: resumeId,
        content: { headline: "Synthetic test resume" },
        atsScore: 80,
        name: "Synthetic User",
        genMs: 10,
        userId,
      }),
      deleteUserAccountData(userId),
    ]);
    const remaining = await client.query<{ users: number; resumes: number }>(
      `select
         (select count(*)::int from users where id=$1) users,
         (select count(*)::int from resumes where id=$2) resumes`,
      [userId, resumeId],
    );
    assert.deepEqual(remaining.rows[0], { users: 0, resumes: 0 });
  }
}

async function verifyDeletionRetentionBoundary(): Promise<void> {
  // Account deletion has to do two opposite things at once: erase the person
  // and keep the accounting record of money actually received. It used to just
  // DELETE the payment row, and it never touched email_log (which has no user
  // column) or ipn_quarantine, so the address and the payout body outlived the
  // account. This proves both halves — what must survive, and what must not.
  const { deleteUserAccountData } = await import("../lib/db");
  const email = "retention-boundary@example.test";
  const userId = await createUser(email);
  const orderId = `premium_monthly_${userId}_${randomUUID()}`;

  await client.query(
    `insert into crypto_payments (id,order_id,user_id_text,status,price_amount)
     values ($1,$2,$3,'finished',12)`,
    [`pay-${userId}`, orderId, userId],
  );
  await client.query(
    `insert into ipn_quarantine (order_id,signature,body) values ($1,'deadbeef','{"payout":"addr"}')`,
    [orderId],
  );
  await client.query(
    `insert into email_log (recipient,subject,type) values ($1,'Verify your email','verification')`,
    [email],
  );

  assert.equal(await deleteUserAccountData(userId), true);

  const payment = await client.query<{ user_id_text: string | null; order_id: string }>(
    "select user_id_text, order_id from crypto_payments where id=$1",
    [`pay-${userId}`],
  );
  // The row survives — deleting it would destroy the record of a real payment.
  assert.equal(payment.rows.length, 1, "payment record must survive account deletion");
  assert.equal(payment.rows[0].user_id_text, null);
  // order_id embeds the user id, so anonymising user_id_text alone would leave
  // the account trivially re-identifiable from the order reference.
  assert.ok(!payment.rows[0].order_id.includes(userId), `order_id still contains the user id: ${payment.rows[0].order_id}`);

  const leftovers = await client.query<{ quarantine: number; emails: number }>(
    `select (select count(*)::int from ipn_quarantine where order_id=$1) quarantine,
            (select count(*)::int from email_log where recipient=$2) emails`,
    [orderId, email],
  );
  assert.deepEqual(leftovers.rows[0], { quarantine: 0, emails: 0 });
}

async function verifyResumeOwnershipConflict(): Promise<void> {
  const { saveResume } = await import("../lib/db");
  const ownerId = await createUser("resume-owner@example.test");
  const attackerId = await createUser("resume-attacker@example.test");
  const resumeId = randomUUID();
  assert.equal(await saveResume({
    id: resumeId,
    content: { headline: "Owner content" },
    atsScore: 90,
    name: "Owner",
    genMs: 10,
    userId: ownerId,
  }), true);
  assert.equal(await saveResume({
    id: resumeId,
    content: { headline: "Attacker content" },
    atsScore: 10,
    name: "Attacker",
    genMs: 10,
    userId: attackerId,
  }), false);
  const stored = await client.query<{ user_id: string; headline: string }>(
    "select user_id,content->>'headline' headline from resumes where id=$1",
    [resumeId],
  );
  assert.deepEqual(stored.rows[0], { user_id: ownerId, headline: "Owner content" });
}

async function verifyPackageBackedResumeDeletion(): Promise<void> {
  const { deleteUserResume } = await import("../lib/db");
  const resumeId = "46000000-0000-4000-8000-000000000001";
  const packageId = "47000000-0000-4000-8000-000000000001";
  const userId = "40000000-0000-4000-8000-000000000001";
  assert.equal(await deleteUserResume(resumeId, userId), true);
  const remaining = await client.query<{ resumes: number; packages: number; approvals: number; attempts: number }>(
    `select
       (select count(*)::int from resumes where id=$1) resumes,
       (select count(*)::int from application_packages where id=$2) packages,
       (select count(*)::int from package_approvals where package_id=$2) approvals,
       (select count(*)::int from application_mail_attempts where package_id=$2) attempts`,
    [resumeId, packageId],
  );
  assert.deepEqual(remaining.rows[0], { resumes: 0, packages: 0, approvals: 0, attempts: 0 });
}

async function verifyDeliveryAndPaymentRecovery(): Promise<void> {
  const tokenUser = await createUser("delivery-state@example.test");
  const { prepareUserVerification } = await import("../lib/email-verification");
  const prepared = await prepareUserVerification(tokenUser, "delivery-state@example.test");
  const emailToken = await client.query<{ delivery_status: string }>(
    "select delivery_status from email_verification_tokens where id=$1",
    [prepared.id],
  );
  assert.equal(emailToken.rows[0]?.delivery_status, "pending");

  const { createStudentToken } = await import("../lib/student");
  const studentPrepared = await createStudentToken(tokenUser, "delivery-state@example.edu");
  const studentToken = await client.query<{ delivery_status: string }>(
    "select delivery_status from student_verification_tokens where id=$1",
    [studentPrepared.id],
  );
  assert.equal(studentToken.rows[0]?.delivery_status, "pending");

  const recoveryOrder = `recovery_${randomUUID()}`;
  await client.query(
    `insert into crypto_payments
       (id, order_id, user_id_text, status, price_amount, plan, days, invoice_attempted_at)
     values ($1,$2,$3,'invoice_unknown',12,'monthly',30,now())`,
    [`pending_${recoveryOrder}`, recoveryOrder, tokenUser],
  );
  const recovery = await client.query<{ status: string; provider_invoice_id: string | null }>(
    "select status,provider_invoice_id from crypto_payments where order_id=$1",
    [recoveryOrder],
  );
  assert.deepEqual(recovery.rows[0], { status: "invoice_unknown", provider_invoice_id: null });
}

async function verifyExistingContracts(): Promise<void> {
  const { refundGenerationCredit, spendCredit, userCredits } = await import("../lib/credits");
  const { q } = await import("../lib/db");
  const rawDatabase = await client.query<{ name: string }>("select current_database() name");
  const applicationDatabase = await q<{ name: string }>("select current_database() name");
  assert.equal(applicationDatabase[0]?.name, rawDatabase.rows[0]?.name);
  const creditUser = await createUser("credits@example.test", 1);
  const resumeId = randomUUID();
  assert.equal(await userCredits(creditUser), 1);
  const spends = await Promise.all([spendCredit(creditUser, resumeId), spendCredit(creditUser, resumeId)]);
  assert.ok(spends[0]);
  assert.equal(spends[0], spends[1]);
  await Promise.all([refundGenerationCredit(creditUser, resumeId), refundGenerationCredit(creditUser, resumeId)]);
  assert.equal(await userCredits(creditUser), 1);
  const { activateStudentOffer, createStudentToken } = await import("../lib/student");
  const studentUser = await createUser("student-account@example.test");
  const preparedStudent = await createStudentToken(studentUser, "learner@example.edu");
  const activations = await Promise.all([
    activateStudentOffer(preparedStudent.token),
    activateStudentOffer(preparedStudent.token),
  ]);
  assert.equal(activations.filter((result) => result.kind === "activated").length, 1);
  const orderId = `integrity_${randomUUID()}`;
  await client.query(`insert into crypto_payments (id,order_id,user_id_text,price_amount) values ($1,$2,$3,12)`,
    [randomUUID(), orderId, studentUser]);
  await expectSqlState(
    `insert into crypto_payments (id,order_id,user_id_text,price_amount)
     values (gen_random_uuid(),'${orderId}','${studentUser}',12)`,
    "23505",
  );

  const trackerUser = await createUser("tracker-owner@example.test");
  const otherTrackerUser = await createUser("tracker-other@example.test");
  const ownedResume = randomUUID();
  const otherResume = randomUUID();
  const indexedJob = randomUUID();
  await client.query(
    "insert into resumes(id,user_id_text,content) values ($1,$2,'{}'),($3,$4,'{}')",
    [ownedResume, trackerUser, otherResume, otherTrackerUser],
  );
  await client.query(
    `insert into jobs(id,provider,external_id,title,company,country_code,apply_url)
       values ($1,'fixture-provider','fixture-job-1','Product Designer','Fixture Co','IN','https://jobs.example.test/fixture-job-1')`,
    [indexedJob],
  );
  const {
    ApplicationDomainError,
    createApplication,
    listApplications,
    updateApplication,
  } = await import("../lib/db");
  await assert.rejects(
    createApplication(trackerUser, {
      company: "Fixture Co",
      role: "Product Designer",
      status: "saved",
      resumeId: otherResume,
      jobId: indexedJob,
    }),
    (error: unknown) => error instanceof ApplicationDomainError && error.code === "resume_not_owned",
  );
  const applicationId = await createApplication(trackerUser, {
    company: "Fixture Co",
    role: "Product Designer",
    status: "saved",
    resumeId: ownedResume,
    jobId: indexedJob,
  });
  await assert.rejects(
    createApplication(trackerUser, {
      company: "Fixture Co",
      role: "Product Designer",
      status: "saved",
      resumeId: ownedResume,
      jobId: indexedJob,
    }),
    (error: unknown) => error instanceof ApplicationDomainError && error.code === "duplicate_application",
  );
  await assert.rejects(
    updateApplication(trackerUser, applicationId, { resumeId: otherResume }),
    (error: unknown) => error instanceof ApplicationDomainError && error.code === "resume_not_owned",
  );
  assert.equal(await updateApplication(trackerUser, applicationId, { status: "interview" }), true);
  const trackerPage = await listApplications(trackerUser, { limit: 1 });
  assert.equal(trackerPage.applications.length, 1);
  assert.equal(trackerPage.applications[0]?.status, "interview");
  assert.equal(trackerPage.applications[0]?.provider_namespace, "fixture-provider");
  await verifyDeletionSerialization();
}

async function verifyMigrationFailureSafety(expectedDigest: string): Promise<void> {
  await client.query("begin");
  try {
    await client.query("drop table users cascade");
    await assert.rejects(applyMigration("032_digest_outbox_and_constraints.sql"));
  } finally {
    await client.query("rollback");
  }
  assert.equal(await schemaDigest(), expectedDigest);
  await client.query("begin");
  try {
    await assert.rejects(client.query(
      "create table migration_interrupt_probe(id integer); select 1/0",
    ));
  } finally {
    await client.query("rollback");
  }
  assert.equal((await client.query<{ name: string | null }>(
    "select to_regclass('public.migration_interrupt_probe')::text name",
  )).rows[0]?.name, null);
}

async function seedJobWorkflows(): Promise<void> {
  await client.query(`
    insert into users(id,email,password_hash,email_verified_at) values
      ('40000000-0000-4000-8000-000000000001','workflow-1@example.test','x',now()),
      ('40000000-0000-4000-8000-000000000002','workflow-2@example.test','x',now());
    insert into career_profile_versions(id,user_id,version,normalized_facts,provenance,facts_hash) values
      ('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,'{}','{}',repeat('a',64)),
      ('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',1,'{}','{}',repeat('b',64));
    insert into account_email_versions(id,user_id,version,normalized_email,verification_source,verified_at) values
      ('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,'workflow-1@example.test','account',now()),
      ('42000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',1,'workflow-2@example.test','account',now());
    -- Readiness gate 1: both signup-required legal documents must be accepted at
    -- their current published version. 047 seeds terms + privacy with
    -- acceptance_required_from = now(), and these users are created after that,
    -- so an acceptance row is mandatory for each.
    insert into legal_acceptances(user_id,document_key,legal_version_id,version_number,content_digest_snapshot,acceptance_surface,request_evidence_digest)
    select account.id, legal.document_key, legal.id, legal.version_number, legal.content_digest, 'email_signup', repeat('a',64)
    from (values ('40000000-0000-4000-8000-000000000001'::uuid),('40000000-0000-4000-8000-000000000002'::uuid)) account(id)
    cross join (
      select distinct on (document.document_key)
        document.document_key, version.id, version.version_number, version.content_digest
      from legal_documents document
      join legal_document_versions version on version.document_key = document.document_key
      where document.required_at_signup = true
        and version.status in ('scheduled', 'published')
        and version.effective_at <= now()
      order by document.document_key, version.effective_at desc, version.version_number desc
    ) legal;
    -- Readiness gate 2: the platform flags. Gate 3: per-user access grants, which
    -- are a second, independent gate -- an approved grant requires a named staff
    -- approver, so the fixture seeds one rather than inserting a headless row.
    update feature_flags set enabled=true where name in ('role_apply_prepare','role_apply_gmail_send');
    insert into staff_accounts(id,email,display_name,status,activated_at) values
      ('4a000000-0000-4000-8000-000000000001','integrity-approver@example.test','Integrity Approver','active',now())
    on conflict (id) do nothing;
    insert into feature_access_grants(user_id,feature_key,state,approved_at,approved_by)
    select account.id, feature.key, 'approved', now(), '4a000000-0000-4000-8000-000000000001'
    from (values ('40000000-0000-4000-8000-000000000001'::uuid),('40000000-0000-4000-8000-000000000002'::uuid)) account(id)
    cross join (values ('role_apply_prepare'),('role_apply_gmail')) feature(key);
    insert into canonical_companies(canonical_company_key,verified_domain,identity_confidence,identity_state) values
      ('domain:alpha.test','alpha.test',10000,'verified'),('domain:beta.test','beta.test',10000,'verified');
    insert into canonical_jobs(canonical_job_key,canonical_company_key,key_kind,official_url_hash) values
      ('url:'||repeat('1',64),'domain:alpha.test','verified_url_hash',repeat('1',64)),
      ('url:'||repeat('2',64),'domain:beta.test','verified_url_hash',repeat('2',64)),
      ('url:'||repeat('3',64),'domain:alpha.test','verified_url_hash',repeat('3',64)),
      ('url:'||repeat('4',64),'domain:alpha.test','verified_url_hash',repeat('4',64));
    -- Snapshots carry posting-backed recipient provenance because
    -- enforce_auto_apply_dispatch_readiness (051) refuses to open an invocation
    -- unless facts->'recipient' proves the address came from the stored posting.
    insert into job_snapshots(id,canonical_job_key,canonical_company_key,provider_namespace,provider_job_id,source_url,source_body,source_body_hash,captured_at,facts)
    select s.id, s.job_key, s.company_key, 'fake', s.provider_job_id, s.url, s.body, s.hash, now(),
      jsonb_build_object('recipient', jsonb_build_object(
        'recipient', 'source_backed',
        'emailInstruction', 'explicit',
        'record', jsonb_build_object(
          'disposition', 'auto_eligible',
          'source', 'stored_posting',
          'employerDomainRelationship', 'example.test',
          'candidates', jsonb_build_array(jsonb_build_object('email','jobs@example.test','warnings',jsonb_build_array())),
          'contentHash', s.hash,
          'canonicalJobKey', s.job_key,
          'canonicalSourceUrl', s.url
        )))
    from (values
      ('43000000-0000-4000-8000-000000000001'::uuid,'url:'||repeat('1',64),'domain:alpha.test','1','https://alpha.test/1','one',repeat('1',64)),
      ('43000000-0000-4000-8000-000000000002'::uuid,'url:'||repeat('2',64),'domain:beta.test','2','https://beta.test/2','two',repeat('2',64)),
      ('43000000-0000-4000-8000-000000000003'::uuid,'url:'||repeat('3',64),'domain:alpha.test','3','https://alpha.test/3','three',repeat('3',64)),
      ('43000000-0000-4000-8000-000000000004'::uuid,'url:'||repeat('4',64),'domain:alpha.test','4','https://alpha.test/4','four',repeat('4',64))
    ) s(id,job_key,company_key,provider_job_id,url,body,hash);
    insert into application_send_policies(user_id,quota_timezone,timezone_generation,user_cap,admin_cap_snapshot) values
      ('40000000-0000-4000-8000-000000000001','UTC',1,1,5),('40000000-0000-4000-8000-000000000002','UTC',1,2,5);
    insert into job_campaigns(id,user_id,mode,authorization_mode,status,profile_version_id,profile_version,criteria_version,criteria,timezone,timezone_generation,daily_time,daily_limit,fit_score_floor,confidence_score_floor) values
      ('44000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','role_apply','review_each','draft','41000000-0000-4000-8000-000000000001',1,1,'{}','UTC',1,'09:00',1,85,80),
      ('44000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','role_apply','review_each','draft','41000000-0000-4000-8000-000000000002',1,1,'{}','UTC',1,'09:00',2,85,80);
    insert into email_connections(id,user_id,provider,provider_tenant,provider_subject,verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,connection_generation) values
      ('45000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','google','google','subject-1','workflow-1@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],digest('rolesharp-mail-v1|user=40000000-0000-4000-8000-000000000001|connection=45000000-0000-4000-8000-000000000001|provider=google|tenant=google|subject=subject-1|generation=1|key=1','sha256')||decode(repeat('aa',16),'hex'),1,decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),1),
      ('45000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','google','google','subject-2','workflow-2@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],digest('rolesharp-mail-v1|user=40000000-0000-4000-8000-000000000002|connection=45000000-0000-4000-8000-000000000002|provider=google|tenant=google|subject=subject-2|generation=1|key=1','sha256')||decode(repeat('dd',16),'hex'),1,decode(repeat('ee',12),'hex'),decode(repeat('ff',16),'hex'),1);
    update job_campaigns set
      pinned_connection_id = case user_id
        when '40000000-0000-4000-8000-000000000001' then '45000000-0000-4000-8000-000000000001'::uuid
        else '45000000-0000-4000-8000-000000000002'::uuid
      end,
      status = 'active'
      where id in ('44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002');
    insert into resumes(id,user_id,content,ats_score) values
      ('46000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','{}',90),
      ('46000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','{}',90);
    -- The three 051 pins are set at INSERT time on purpose:
    -- application_packages_immutable rejects any later UPDATE of them, so a
    -- seed-then-patch fixture cannot work. recipient_record is derived from the
    -- snapshot's own record plus jobSnapshotId, which is exactly the identity
    -- the readiness trigger recomputes.
    insert into application_packages(id,user_id,canonical_job_key,canonical_company_key,job_snapshot_id,profile_version_id,resume_id,template_version,policy_version,score_version,extraction_version,connection_id,connection_generation,recipient_record,subject,body,attachment_hash,attachment_bytes_hash,package_hash,status,source_body_hash_snapshot,source_url_snapshot,legal_version_snapshot)
    select ('47000000-0000-4000-8000-00000000000'||v.n)::uuid,v.user_id,snapshot.canonical_job_key,snapshot.canonical_company_key,snapshot.id,v.profile,v.resume,1,1,1,1,v.connection,1,
      (snapshot.facts->'recipient'->'record') || jsonb_build_object('jobSnapshotId', snapshot.id::text),
      'Synthetic subject','Synthetic body',repeat(v.n::text,64),repeat(v.n::text,64),repeat(chr(96+v.n),64),'preparing',
      snapshot.source_body_hash, snapshot.source_url,
      (select jsonb_agg(jsonb_build_object('documentKey', legal.document_key, 'id', legal.id, 'versionNumber', legal.version_number, 'contentDigest', legal.content_digest) order by legal.document_key)
       from (
         select distinct on (document.document_key)
           document.document_key, version.id, version.version_number, version.content_digest
         from legal_documents document
         join legal_document_versions version on version.document_key = document.document_key
         where document.required_at_signup = true
           and version.status in ('scheduled', 'published')
           and version.effective_at <= now()
         order by document.document_key, version.effective_at desc, version.version_number desc
       ) legal)
    from (values (1,'40000000-0000-4000-8000-000000000001'::uuid,'41000000-0000-4000-8000-000000000001'::uuid,'46000000-0000-4000-8000-000000000001'::uuid,'45000000-0000-4000-8000-000000000001'::uuid),(2,'40000000-0000-4000-8000-000000000001'::uuid,'41000000-0000-4000-8000-000000000001'::uuid,'46000000-0000-4000-8000-000000000001'::uuid,'45000000-0000-4000-8000-000000000001'::uuid),(3,'40000000-0000-4000-8000-000000000002'::uuid,'41000000-0000-4000-8000-000000000002'::uuid,'46000000-0000-4000-8000-000000000002'::uuid,'45000000-0000-4000-8000-000000000002'::uuid),(4,'40000000-0000-4000-8000-000000000002'::uuid,'41000000-0000-4000-8000-000000000002'::uuid,'46000000-0000-4000-8000-000000000002'::uuid,'45000000-0000-4000-8000-000000000002'::uuid)) v(n,user_id,profile,resume,connection)
    join job_snapshots snapshot on snapshot.id = ('43000000-0000-4000-8000-00000000000'||v.n)::uuid;
    update application_packages set status='ready';
    insert into package_approvals(id,user_id,package_id,package_hash,authorization_mode,actor,campaign_id,selected_recipient,expires_at)
    select ('48000000-0000-4000-8000-00000000000'||n)::uuid,user_id,('47000000-0000-4000-8000-00000000000'||n)::uuid,repeat(chr(96+n),64),'review_each','user',campaign,'jobs@example.test',now()+interval '1 hour'
    from (values (1,'40000000-0000-4000-8000-000000000001'::uuid,'44000000-0000-4000-8000-000000000001'::uuid),(2,'40000000-0000-4000-8000-000000000001'::uuid,'44000000-0000-4000-8000-000000000001'::uuid),(3,'40000000-0000-4000-8000-000000000002'::uuid,'44000000-0000-4000-8000-000000000002'::uuid),(4,'40000000-0000-4000-8000-000000000002'::uuid,'44000000-0000-4000-8000-000000000002'::uuid)) v(n,user_id,campaign);
    insert into application_mail_attempts(id,user_id,canonical_job_key,canonical_company_key,package_id,approval_id,campaign_id,connection_id)
    select ('49000000-0000-4000-8000-00000000000'||n)::uuid,user_id,'url:'||repeat(n::text,64),company,('47000000-0000-4000-8000-00000000000'||n)::uuid,('48000000-0000-4000-8000-00000000000'||n)::uuid,campaign,connection
    from (values (1,'40000000-0000-4000-8000-000000000001'::uuid,'domain:alpha.test','44000000-0000-4000-8000-000000000001'::uuid,'45000000-0000-4000-8000-000000000001'::uuid),(2,'40000000-0000-4000-8000-000000000001'::uuid,'domain:beta.test','44000000-0000-4000-8000-000000000001'::uuid,'45000000-0000-4000-8000-000000000001'::uuid),(3,'40000000-0000-4000-8000-000000000002'::uuid,'domain:alpha.test','44000000-0000-4000-8000-000000000002'::uuid,'45000000-0000-4000-8000-000000000002'::uuid),(4,'40000000-0000-4000-8000-000000000002'::uuid,'domain:alpha.test','44000000-0000-4000-8000-000000000002'::uuid,'45000000-0000-4000-8000-000000000002'::uuid)) v(n,user_id,company,campaign,connection);
  `);
}

async function verifyJobWorkflowContracts(): Promise<void> {
  await seedJobWorkflows();
  await verifyAttemptTransitionGraph();
  await client.query(`update application_mail_attempts set status='reserved'`);
  await expectSqlState(`update career_profile_versions set normalized_facts='{"changed":true}' where id='41000000-0000-4000-8000-000000000001'`, "55000");
  await expectSqlState(`update account_email_versions set normalized_email='changed@example.test' where id='42000000-0000-4000-8000-000000000001'`, "55000");
  await expectSqlState(`insert into account_email_versions(user_id,version,normalized_email,verification_source,verified_at) values ('40000000-0000-4000-8000-000000000001',3,'skip@example.test','account',now())`, "23514");
  await expectSqlState(`update application_mail_attempts set status='needs_user' where id='49000000-0000-4000-8000-000000000001'`, "23514");
  await expectSqlState(`insert into job_campaigns(user_id,mode,authorization_mode,status,profile_version_id,profile_version,criteria_version,criteria,timezone,timezone_generation,daily_time,daily_limit,fit_score_floor,confidence_score_floor,pinned_connection_id) values ('40000000-0000-4000-8000-000000000001','role_apply','review_each','active','41000000-0000-4000-8000-000000000001',1,2,'{}','UTC',1,'10:00',1,85,80,'45000000-0000-4000-8000-000000000001')`, "23505");
  await expectSqlState(`insert into email_connections(id,user_id,provider,provider_tenant,provider_subject,verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,connection_generation) values ('45000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','google','google','subject-1','other@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],digest('rolesharp-mail-v1|user=40000000-0000-4000-8000-000000000002|connection=45000000-0000-4000-8000-000000000005|provider=google|tenant=google|subject=subject-1|generation=1|key=1','sha256')||decode(repeat('aa',16),'hex'),1,decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),1)`, "23505");
  await expectSqlState(`insert into application_packages(user_id,canonical_job_key,canonical_company_key,job_snapshot_id,profile_version_id,resume_id,template_version,policy_version,score_version,extraction_version,connection_id,connection_generation,recipient_record,subject,body,attachment_hash,attachment_bytes_hash,package_hash) values ('40000000-0000-4000-8000-000000000002','url:'||repeat('1',64),'domain:alpha.test','43000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000001',1,1,1,1,'45000000-0000-4000-8000-000000000002',1,'{}','x','x',repeat('e',64),repeat('e',64),repeat('f',64))`, "23503");
  await expectSqlState(`update application_packages set body='mutated' where id='47000000-0000-4000-8000-000000000001'`, "55000");
  await expectSqlState(`update package_approvals set selected_recipient='other@example.test' where id='48000000-0000-4000-8000-000000000001'`, "55000");
  await expectSqlState(`insert into application_mail_attempts(user_id,canonical_job_key,canonical_company_key,package_id,approval_id,campaign_id,connection_id) values ('40000000-0000-4000-8000-000000000001','url:'||repeat('1',64),'domain:alpha.test','47000000-0000-4000-8000-000000000001','48000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001')`, "23505");
  await expectSqlState(`insert into email_connections(user_id,provider,provider_tenant,provider_subject,verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,connection_generation) values ('40000000-0000-4000-8000-000000000001','google','google','bad-envelope','bad@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],decode('aa','hex'),1,decode('bb','hex'),decode('cc','hex'),2)`, "23514");
  await expectSqlState(`insert into email_connections(user_id,provider,provider_tenant,provider_subject,verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,connection_generation) values ('40000000-0000-4000-8000-000000000001','google','google','plaintext-token','plain@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],convert_to('ya29.plaintext-refresh-token','UTF8'),1,decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),2)`, "23514");
  await expectSqlState(`update application_send_policies set quota_timezone='Not/AZone' where user_id='40000000-0000-4000-8000-000000000001'`, "23514");
  await expectSqlState(`update job_campaigns set pending_timezone='Not/AZone' where id='44000000-0000-4000-8000-000000000001'`, "23514");
  await client.query(`insert into oauth_transactions(id,user_id,provider,session_hash,state_hash,nonce_hash,pkce_ciphertext,pkce_key_version,pkce_nonce,pkce_tag,redirect_uri,expires_at) values ('52000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','google',repeat('1',64),repeat('2',64),repeat('3',64),decode(repeat('aa',16),'hex'),1,decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),'https://rolesharp.test/oauth/callback',now()+interval '5 minutes'); select retire_oauth_transaction('52000000-0000-4000-8000-000000000001','consumed')`);
  await expectSqlState(`insert into oauth_transactions(user_id,provider,session_hash,state_hash,nonce_hash,pkce_ciphertext,pkce_key_version,pkce_nonce,pkce_tag,redirect_uri,expires_at) values ('40000000-0000-4000-8000-000000000001','google',repeat('4',64),repeat('2',64),repeat('5',64),decode(repeat('dd',16),'hex'),1,decode(repeat('ee',12),'hex'),decode(repeat('ff',16),'hex'),'https://rolesharp.test/oauth/callback',now()+interval '5 minutes')`, "23505");
  assert.equal((await client.query<{ purged: number }>(`select purge_oauth_state_tombstones(now()+interval '25 hours') purged`)).rows[0]?.purged, 1);
  const aad = await client.query<{ refresh_aad: string }>(`select refresh_aad from email_connections order by id`);
  assert.equal(aad.rows.length, 2);
  assert.notEqual(aad.rows[0]?.refresh_aad, aad.rows[1]?.refresh_aad);
  await expectSqlState(`update email_connections set refresh_ciphertext=(select refresh_ciphertext from email_connections where id='45000000-0000-4000-8000-000000000001') where id='45000000-0000-4000-8000-000000000002'`, "23514");
  await client.query(`insert into canonical_job_aliases(provider_namespace,provider_job_id,canonical_job_key,verified_official_url_hash) values ('source-a','same-url-a','url:'||repeat('1',64),repeat('1',64)),('source-b','same-url-b','url:'||repeat('1',64),repeat('1',64))`);
  await expectSqlState(`insert into canonical_job_aliases(provider_namespace,provider_job_id,canonical_job_key,verified_official_url_hash) values ('source-a','same-url-a','url:'||repeat('2',64),repeat('2',64))`, "23505");
  await expectSqlState(`insert into canonical_jobs(canonical_job_key,canonical_company_key,key_kind,official_url_hash) values ('url:'||repeat('1',64),'domain:alpha.test','verified_url_hash',repeat('1',64))`, "23505");
  await client.query("begin");
  try {
    await client.query(`insert into canonical_job_aliases(provider_namespace,provider_job_id,canonical_job_key,verified_official_url_hash) values ('conflict-a','attempt-a','url:'||repeat('1',64),repeat('9',64)),('conflict-b','attempt-b','url:'||repeat('2',64),repeat('9',64)); insert into canonical_job_conflicts(official_url_hash,left_canonical_job_key,right_canonical_job_key,reason) values (repeat('9',64),'url:'||repeat('1',64),'url:'||repeat('2',64),'attempt-bearing alias collision')`);
    assert.equal((await client.query<{ blocked: number }>(`select count(*)::int blocked from canonical_jobs where canonical_job_key in ('url:'||repeat('1',64),'url:'||repeat('2',64)) and merge_state='conflicted' and automation_blocked`)).rows[0]?.blocked, 2);
  } finally {
    await client.query("rollback");
  }
  await client.query("begin");
  try {
    await client.query(`update canonical_companies set identity_state='ambiguous',automation_blocked=true where canonical_company_key='domain:alpha.test'`);
    await assert.rejects(
      client.query(`select start_application_mail_invocation('49000000-0000-4000-8000-000000000001')`),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "23514",
    );
  } finally {
    await client.query("rollback");
  }

  const racer = new Client({ connectionString: databaseUrl });
  await racer.connect();
  await client.query(`
    insert into users(id,email,password_hash,email_verified_at) values ('40000000-0000-4000-8000-000000000004','campaign-race@example.test','x',now());
    insert into career_profile_versions(id,user_id,version,normalized_facts,provenance,facts_hash) values ('41000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004',1,'{}','{}',repeat('d',64));
    insert into application_send_policies(user_id,quota_timezone,timezone_generation,user_cap,admin_cap_snapshot) values ('40000000-0000-4000-8000-000000000004','UTC',1,2,2);
    insert into email_connections(id,user_id,provider,provider_tenant,provider_subject,verified_sender,granted_scopes,refresh_ciphertext,key_version,refresh_nonce,refresh_tag,connection_generation) values ('45000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','google','google','subject-4','campaign-race@example.test',array['openid','email','https://www.googleapis.com/auth/gmail.send'],digest('rolesharp-mail-v1|user=40000000-0000-4000-8000-000000000004|connection=45000000-0000-4000-8000-000000000004|provider=google|tenant=google|subject=subject-4|generation=1|key=1','sha256')||decode(repeat('ab',16),'hex'),1,decode(repeat('bc',12),'hex'),decode(repeat('cd',16),'hex'),1)
  `);
  const activeCampaignRaceSql = `insert into job_campaigns(user_id,mode,authorization_mode,status,profile_version_id,profile_version,criteria_version,criteria,timezone,timezone_generation,daily_time,daily_limit,fit_score_floor,confidence_score_floor,pinned_connection_id) values ('40000000-0000-4000-8000-000000000004','role_apply','review_each','active','41000000-0000-4000-8000-000000000004',1,1,'{}','UTC',1,'09:00',2,85,80,'45000000-0000-4000-8000-000000000004')`;
  const campaignRace = await Promise.allSettled([
    client.query(activeCampaignRaceSql),
    racer.query(activeCampaignRaceSql),
  ]);
  assert.equal(campaignRace.filter(({ status }) => status === "fulfilled").length, 1);
  const capRace = await Promise.allSettled([
    client.query(`select start_application_mail_invocation('49000000-0000-4000-8000-000000000001')`),
    racer.query(`select start_application_mail_invocation('49000000-0000-4000-8000-000000000002')`),
  ]);
  assert.equal(capRace.filter(({ status }) => status === "fulfilled").length, 1);
  const cooldownRace = await Promise.allSettled([
    client.query(`select start_application_mail_invocation('49000000-0000-4000-8000-000000000003')`),
    racer.query(`select start_application_mail_invocation('49000000-0000-4000-8000-000000000004')`),
  ]);
  assert.equal(cooldownRace.filter(({ status }) => status === "fulfilled").length, 1);
  await racer.end();
  const acceptedAttempt = await client.query<{ id: string; ordinal: number }>(
    `select id,current_invocation_ordinal ordinal from application_mail_attempts
     where user_id='40000000-0000-4000-8000-000000000001' and status='sending'`,
  );
  assert.ok(acceptedAttempt.rows[0]);
  assert.equal((await client.query<{ completed: number }>(
    `select complete_application_mail_invocation($1,$2,'provider_accepted','accepted',repeat('a',64)) completed`,
    [acceptedAttempt.rows[0].id, acceptedAttempt.rows[0].ordinal],
  )).rows[0]?.completed, 1);
  assert.equal((await client.query<{ completed: number }>(
    `select complete_application_mail_invocation($1,$2,'provider_accepted','accepted',repeat('a',64)) completed`,
    [acceptedAttempt.rows[0].id, acceptedAttempt.rows[0].ordinal],
  )).rows[0]?.completed, 0);
  const deletingAttempt = await client.query<{ id: string; ordinal: number }>(
    `select id,current_invocation_ordinal ordinal from application_mail_attempts
     where user_id='40000000-0000-4000-8000-000000000002' and status='sending'`,
  );
  assert.ok(deletingAttempt.rows[0]);
  await client.query(`select begin_user_workflow_deletion('40000000-0000-4000-8000-000000000002')`);
  assert.equal((await client.query<{ completed: number }>(
    `select complete_application_mail_invocation($1,$2,'provider_accepted','late',repeat('b',64)) completed`,
    [deletingAttempt.rows[0].id, deletingAttempt.rows[0].ordinal],
  )).rows[0]?.completed, 0);
  await client.query(`delete from users where id='40000000-0000-4000-8000-000000000002'`);
  assert.equal((await client.query<{ completed: number }>(
    `select complete_application_mail_invocation($1,$2,'provider_accepted','late',repeat('b',64)) completed`,
    [deletingAttempt.rows[0].id, deletingAttempt.rows[0].ordinal],
  )).rows[0]?.completed, 0);

  await client.query(`insert into job_campaigns(id,user_id,mode,authorization_mode,status,profile_version_id,profile_version,criteria_version,criteria,timezone,timezone_generation,daily_time,daily_limit,fit_score_floor,confidence_score_floor) values ('44000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000001','daily_matches','review_each','active','41000000-0000-4000-8000-000000000001',1,1,'{}','UTC',1,'08:00',10,70,60); insert into digest_runs(id,user_id,campaign_id,local_date,account_email_version_id,account_email_version,ordered_snapshot,status) values ('51000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000010',current_date,'42000000-0000-4000-8000-000000000001',1,'[]','prepared'); update digest_runs set status='queued' where id='51000000-0000-4000-8000-000000000001'; insert into notification_outbox(id,user_id,aggregate_type,aggregate_id,account_email_version_id,payload_reference_ids) values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','digest_run','51000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',array['51000000-0000-4000-8000-000000000001'::uuid]); update notification_outbox set status='claimed',lease_owner='test',lease_expires_at=now()+interval '1 minute' where id='50000000-0000-4000-8000-000000000001'; select start_notification_outbox_invocation('50000000-0000-4000-8000-000000000001')`);
  await expectSqlState(`select start_notification_outbox_invocation('50000000-0000-4000-8000-000000000001')`, "23514");
  assert.equal((await client.query<{ completed: number }>(`select complete_notification_outbox_invocation('50000000-0000-4000-8000-000000000001','provider_accepted',repeat('a',64)) completed`)).rows[0]?.completed, 1);
  assert.equal((await client.query<{ completed: number }>(`select complete_notification_outbox_invocation('50000000-0000-4000-8000-000000000001','provider_accepted',repeat('a',64)) completed`)).rows[0]?.completed, 0);
  await expectSqlState(`insert into digest_runs(user_id,campaign_id,local_date,account_email_version_id,account_email_version,ordered_snapshot) values ('40000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000010',current_date,'42000000-0000-4000-8000-000000000001',1,'[]')`, "23505");
  await client.query(`insert into users(id,email,password_hash,email_verified_at) values ('40000000-0000-4000-8000-000000000003','delete@example.test','x',now()); insert into account_email_versions(id,user_id,version,normalized_email,verification_source,verified_at) values ('42000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',1,'delete@example.test','account',now()); insert into notification_outbox(id,user_id,aggregate_type,aggregate_id,account_email_version_id,payload_reference_ids,status,lease_owner,lease_expires_at) values ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','account_notice',gen_random_uuid(),'42000000-0000-4000-8000-000000000003',array[gen_random_uuid()],'claimed','test',now()+interval '1 minute'); select start_notification_outbox_invocation('50000000-0000-4000-8000-000000000003'); select begin_user_workflow_deletion('40000000-0000-4000-8000-000000000003')`);
  assert.equal((await client.query<{ started: number }>(`select start_notification_outbox_invocation('50000000-0000-4000-8000-000000000003') started`)).rows[0]?.started, 0);
  assert.equal((await client.query<{ completed: number }>(`select complete_notification_outbox_invocation('50000000-0000-4000-8000-000000000003','provider_accepted') completed`)).rows[0]?.completed, 0);
  await client.query(`delete from users where id='40000000-0000-4000-8000-000000000003'`);
  assert.equal((await client.query<{ started: number }>(`select start_notification_outbox_invocation('50000000-0000-4000-8000-000000000003') started`)).rows[0]?.started, 0);
  assert.equal((await client.query<{ completed: number }>(`select complete_notification_outbox_invocation('50000000-0000-4000-8000-000000000003','provider_accepted') completed`)).rows[0]?.completed, 0);
}

async function verifyJobsWorkflowServiceIntegration(): Promise<void> {
  const tokenKey = Buffer.alloc(32, 0x5a).toString("base64");
  Object.assign(process.env, {
    JOBS_WORKFLOWS_ENABLED: "true",
    ROLE_APPLY_GMAIL_SEND_ENABLED: "true",
    ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
    APPLICATION_EMAIL_ADMIN_DAILY_LIMIT: "5",
    MAIL_TOKEN_KEYS: `1:${tokenKey}`,
    MAIL_TOKEN_ACTIVE_KEY_VERSION: "1",
    MAIL_CALLBACK_ORIGINS: "https://rolesharp.test",
    GMAIL_CONNECTION_CLIENT_ID: "synthetic-gmail-client",
    GMAIL_CONNECTION_CLIENT_SECRET: "synthetic-gmail-secret",
    GMAIL_CONNECTION_REDIRECT_URI: "https://rolesharp.test/api/mail-connections/gmail/callback",
  });
  await client.query(
    `update feature_flags set enabled=true where name in (
      'jobs_daily_matches','role_apply_prepare','role_apply_gmail_send'
    )`,
  );
  const [{ jobsWorkflowConfig }, profiles, campaigns, connections, matches, digests, packages, mail, db, scheduler] = await Promise.all([
    import("../lib/jobs-workflow/config"),
    import("../lib/jobs-workflow/profiles"),
    import("../lib/jobs-workflow/campaigns"),
    import("../lib/mail/connections"),
    import("../lib/jobs-workflow/matches"),
    import("../lib/jobs-workflow/digests"),
    import("../lib/jobs-workflow/packages"),
    import("../lib/mail/dispatch"),
    import("../lib/db"),
    import("../lib/jobs-workflow/scheduler"),
  ]);
  const userId = await createUser("jobs-integration@example.test");
  const profile = await profiles.createCareerProfileVersion(userId, {
    desiredTitles: ["Product Designer"],
    skills: ["Figma", "User research", "Prototyping", "Analytics"].map((name) => ({
      name, state: "possessed" as const,
    })),
    relevantExperienceMonths: 84,
    seniority: { level: "mid", track: "individual" },
    acceptedTracks: ["individual"],
    locations: ["Remote"],
    remotePolicies: ["remote"],
    authorization: "needs_sponsorship",
    workTypes: ["full_time"],
    compensationFloor: { amountMinor: 10_000_000, currency: "USD", period: "annual" },
  }) as { id: string };
  // The provider boundary hard cap is five calls per user-local day.
  await campaigns.upsertApplicationSendPolicy(userId, { timezone: "UTC", userLimit: 5 });
  const config = jobsWorkflowConfig();
  const connection = await connections.saveMailboxConnection(userId, {
    provider: "google", tenant: "google", subject: "synthetic-google-subject",
    verifiedSender: "sender@example.test",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.send"],
    refreshToken: "synthetic-refresh-token",
  }, config);
  const criteria = {
    desiredTitles: ["Product Designer"], mustHaveSkills: ["Figma", "User research", "Prototyping"],
    preferredSkills: ["Analytics"], countries: ["US"], locations: ["Remote"],
    remotePolicies: ["remote" as const], workTypes: ["full_time" as const],
    authorization: "needs_sponsorship" as const,
    compensationFloor: { amountMinor: 10_000_000, currency: "USD", period: "annual" as const },
    excludedCompanies: [], blockedSources: [],
  };
  const daily = await campaigns.createCampaign(userId, {
    mode: "daily_matches", authorizationMode: "review_each", status: "active",
    profileVersionId: profile.id, criteria, timezone: "UTC", dailyTime: "08:00",
    dailyLimit: 10, fitScoreFloor: 70, confidenceScoreFloor: 60,
  }) as { id: string };
  const apply = await campaigns.createCampaign(userId, {
    mode: "role_apply", authorizationMode: "review_each", status: "active",
    profileVersionId: profile.id, criteria, timezone: "UTC", dailyTime: "08:00",
    dailyLimit: 5, fitScoreFloor: 75, confidenceScoreFloor: 65,
    pinnedConnectionId: connection.id, consentConfirmed: false,
  }) as { id: string };
  const resumeId = randomUUID();
  assert.equal(await db.saveResume({
    id: resumeId,
    content: {
      headline: "Product Designer", summary: "Product designer focused on evidence-backed systems.",
      skills: ["Analytics", "Prototyping", "User research", "Figma"],
      experiences: [{ title: "Product Designer", company: "Synthetic Studio", period: "2019–2026",
        bullets: ["Facilitated workshops", "Built Figma systems and research prototypes"] }],
      education: [], projects: [], certifications: [], languages: [], achievements: [],
    },
    atsScore: 92, name: "Synthetic Candidate", genMs: 10, userId,
  }), true);
  const noQueue = async () => undefined;
  async function prepareSyntheticAttempt(input: {
    externalId: string; company: string; companyDomain: string; recipient: string; approvalNow?: Date;
  }): Promise<string> {
    const jobId = randomUUID();
    const sourceUrl = `https://careers.${input.companyDomain}/jobs/${input.externalId}`;
    await client.query(
      `insert into jobs(id,provider,external_id,title,company,country_code,location,is_remote,job_type,
         description,apply_url,source_url,company_url,salary_min,salary_max,salary_currency,
         salary_interval,date_posted,last_seen_at,expires_at,metadata)
       values($1,'synthetic-provider',$2,'Product Designer',$3,'US','Remote',true,'full_time',
         $4,$5,$5,$6,120000,150000,'USD','annual',now()-interval '1 day',now(),
         now()+interval '20 days','{}')`,
      [jobId, input.externalId, input.company,
        `Required skills: Figma, user research, and prototyping. 5 years of experience. Preferred skill: analytics. Visa sponsorship is available. To apply, email your CV to ${input.recipient}.`,
        sourceUrl, `https://${input.companyDomain}`],
    );
    await matches.materializeCampaignMatches(apply.id);
    const match = (await client.query<{ id: string }>(
      `select m.id from job_matches m join canonical_job_aliases a
         on a.canonical_job_key=m.canonical_job_key
       where m.user_id=$1 and m.campaign_id=$2 and m.status='eligible'
         and a.provider_namespace='synthetic-provider' and a.provider_job_id=$3`,
      [userId, apply.id, input.externalId],
    )).rows[0];
    assert.ok(match?.id, `eligible match missing for ${input.externalId}`);
    const prepared = await packages.prepareApplicationPackage(match.id, noQueue);
    assert.ok(prepared.packageId, `package missing for ${input.externalId}`);
    assert.deepEqual(await packages.approveApplicationPackages(userId, [{
      packageId: prepared.packageId, selectedRecipient: input.recipient,
    }], noQueue, input.approvalNow), { approved: 1, queued: 1 });
    const attempt = (await client.query<{ id: string }>(
      "select id from application_mail_attempts where user_id=$1 and package_id=$2",
      [userId, prepared.packageId],
    )).rows[0];
    assert.ok(attempt?.id, `attempt missing for ${input.externalId}`);
    return attempt.id;
  }
  const indexedJobId = randomUUID();
  await client.query(
    `insert into jobs(id,provider,external_id,title,company,country_code,location,is_remote,job_type,
       description,apply_url,source_url,company_url,salary_min,salary_max,salary_currency,
       salary_interval,date_posted,last_seen_at,expires_at,metadata)
     values($1,'synthetic-provider','product-designer-1','Product Designer','Example','US','Remote',true,'full_time',
       $2,'https://careers.example.test/jobs/product-designer-1','https://careers.example.test/jobs/product-designer-1',
       'https://example.test',120000,150000,'USD','annual',now()-interval '1 day',now(),now()+interval '20 days','{}')`,
    [indexedJobId, "Required skills: Figma, user research, and prototyping. 5 years of experience. Preferred skill: analytics. Visa sponsorship is available. To apply, email your CV to jobs@example.test."],
  );
  assert.ok((await matches.materializeCampaignMatches(daily.id)).created >= 1);
  assert.ok((await matches.materializeCampaignMatches(apply.id)).created >= 1);
  const eligible = await client.query<{ id: string; fit_score: number; confidence_score: number }>(
    `select id,fit_score,confidence_score from job_matches where user_id=$1 and campaign_id=$2
       and canonical_job_key in (select canonical_job_key from canonical_job_aliases
         where provider_namespace='synthetic-provider' and provider_job_id='product-designer-1')
       and status='eligible'`, [userId, apply.id],
  );
  assert.ok(eligible.rows[0]);
  assert.ok(eligible.rows[0].fit_score >= 85 && eligible.rows[0].confidence_score >= 80);

  const digest = await digests.prepareDailyDigest(daily.id, noQueue);
  assert.ok(digest.digestId && digest.outboxId);
  assert.equal(await digests.claimNotificationOutbox(digest.outboxId, "synthetic-integration", 90), true);
  let digestSubject = "";
  assert.equal(await digests.deliverNotificationOutbox(digest.outboxId, async (message) => {
    digestSubject = message.subject;
    return "queued";
  }), "provider_accepted");
  assert.match(digestSubject, /Daily Matches/u);

  const prepared = await packages.prepareApplicationPackage(eligible.rows[0].id, noQueue);
  assert.ok(prepared.packageId);
  const packageRow = await client.query<{ status: string; recipient_record: { candidates: { email: string }[] } }>(
    "select status,recipient_record from application_packages where id=$1", [prepared.packageId],
  );
  assert.equal(packageRow.rows[0]?.status, "review_required");
  assert.equal(packageRow.rows[0]?.recipient_record.candidates[0]?.email, "jobs@example.test");
  const approved = await packages.approveApplicationPackages(userId, [{
    packageId: prepared.packageId, selectedRecipient: "jobs@example.test",
  }], noQueue);
  assert.deepEqual(approved, { approved: 1, queued: 1 });
  const attempt = await client.query<{ id: string }>(
    "select id from application_mail_attempts where user_id=$1 and package_id=$2", [userId, prepared.packageId],
  );
  assert.ok(attempt.rows[0]);
  const providerCalls: string[] = [];
  const fakeFetch: typeof fetch = async (request, init) => {
    const url = String(request);
    providerCalls.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      assert.match(String(new Headers(init?.headers).get("Authorization")), /^Bearer synthetic-access-token$/u);
      const requestBody = JSON.parse(String(init?.body)) as { raw?: unknown };
      assert.equal(typeof requestBody.raw, "string");
      return new Response(JSON.stringify({ id: "synthetic-provider-id", threadId: "synthetic-thread" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected_provider_request:${url}`);
  };
  assert.equal(await mail.dispatchApplicationAttempt(attempt.rows[0].id, fakeFetch), "provider_accepted");
  assert.deepEqual(providerCalls, [
    "https://oauth2.googleapis.com/token",
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  ]);
  assert.equal((await client.query<{ status: string }>(
    "select status from application_mail_attempts where id=$1", [attempt.rows[0].id],
  )).rows[0]?.status, "provider_accepted");

  const retryAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-retry", company: "Retry Fixture", companyDomain: "retry.test",
    recipient: "jobs@retry.test",
  });
  let retrySendCalls = 0;
  const rejectedFetch: typeof fetch = async (request) => {
    const url = String(request);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      retrySendCalls += 1;
      return new Response("rate limited", { status: 429, headers: { "Retry-After": "1200" } });
    }
    throw new Error(`unexpected_provider_request:${url}`);
  };
  assert.equal(await mail.dispatchApplicationAttempt(retryAttemptId, rejectedFetch), "retryable");
  let retryRow = (await client.query<{ status: string; ordinal: number; delay_seconds: number }>(
    `select status,current_invocation_ordinal ordinal,
       extract(epoch from retry_not_before-now())::int delay_seconds
     from application_mail_attempts where id=$1`, [retryAttemptId],
  )).rows[0];
  assert.equal(retryRow?.status, "retryable");
  assert.equal(retryRow?.ordinal, 1);
  assert.ok((retryRow?.delay_seconds ?? 0) >= 1190 && (retryRow?.delay_seconds ?? 0) <= 1210);
  await client.query("update application_mail_attempts set retry_not_before=now() where id=$1", [retryAttemptId]);
  assert.equal(await mail.dispatchApplicationAttempt(retryAttemptId, rejectedFetch), "retryable");
  retryRow = (await client.query<{ status: string; ordinal: number; delay_seconds: number }>(
    `select status,current_invocation_ordinal ordinal,
       extract(epoch from retry_not_before-now())::int delay_seconds
     from application_mail_attempts where id=$1`, [retryAttemptId],
  )).rows[0];
  assert.equal(retryRow?.status, "retryable");
  assert.equal(retryRow?.ordinal, 2);
  assert.ok((retryRow?.delay_seconds ?? 0) >= 1790 && (retryRow?.delay_seconds ?? 0) <= 1810);
  await client.query("update application_mail_attempts set retry_not_before=now() where id=$1", [retryAttemptId]);
  assert.equal(await mail.dispatchApplicationAttempt(retryAttemptId, rejectedFetch), "terminal_failed");
  assert.deepEqual((await client.query<{ status: string; ordinal: number; retry_not_before: string | null }>(
    `select status,current_invocation_ordinal ordinal,retry_not_before
     from application_mail_attempts where id=$1`, [retryAttemptId],
  )).rows[0], { status: "terminal_failed", ordinal: 3, retry_not_before: null });
  assert.equal(retrySendCalls, 3);
  assert.equal(await mail.dispatchApplicationAttempt(retryAttemptId, rejectedFetch), "missing");
  assert.equal(retrySendCalls, 3);

  const unknownAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-503", company: "Unknown Fixture", companyDomain: "unknown.test",
    recipient: "jobs@unknown.test",
  });
  let unknownSendCalls = 0;
  const uncertainFetch: typeof fetch = async (request) => {
    const url = String(request);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      unknownSendCalls += 1;
      return new Response("uncertain", { status: 503 });
    }
    throw new Error(`unexpected_provider_request:${url}`);
  };
  assert.equal(await mail.dispatchApplicationAttempt(unknownAttemptId, uncertainFetch), "unknown");
  assert.equal(await mail.dispatchApplicationAttempt(unknownAttemptId, uncertainFetch), "missing");
  assert.equal(unknownSendCalls, 1);

  const sixthAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-sixth", company: "Cap Fixture", companyDomain: "cap.test",
    recipient: "jobs@cap.test",
  });
  let sixthProviderCalls = 0;
  assert.equal(await mail.dispatchApplicationAttempt(sixthAttemptId, async () => {
    sixthProviderCalls += 1;
    throw new Error("sixth call must stop before provider access");
  }), "blocked");
  assert.equal(sixthProviderCalls, 0);
  assert.deepEqual((await client.query<{ count: number; cap: number }>(
    `select count,effective_cap_snapshot cap from application_daily_counters
     where user_id=$1 order by local_date desc limit 1`, [userId],
  )).rows[0], { count: 5, cap: 5 });

  // Later assertions cover independent state-machine cases. Start them with a
  // fresh synthetic local-day counter without changing immutable invocations.
  // Both boundaries must roll: 043 caps per policy generation and 046 added a
  // second, independent per-provider counter. Resetting only the first leaves
  // the provider counter pinned at 5 and blocks every scenario below.
  await client.query("delete from application_daily_counters where user_id=$1", [userId]);
  await client.query("delete from application_provider_daily_counters where user_id=$1", [userId]);

  const expiredAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-expired-approval", company: "Expiry Fixture",
    companyDomain: "expiry.test", recipient: "jobs@expiry.test",
    approvalNow: new Date(Date.now() - 25 * 3600_000),
  });
  const beforeRenewal = (await client.query<{ package_id: string; approval_id: string }>(
    "select package_id,approval_id from application_mail_attempts where id=$1", [expiredAttemptId],
  )).rows[0];
  assert.ok(beforeRenewal);
  let expiredApprovalCalls = 0;
  assert.equal(await mail.dispatchApplicationAttempt(expiredAttemptId, async () => {
    expiredApprovalCalls += 1;
    throw new Error("expired approval must stop before provider access");
  }), "needs_user");
  assert.equal(expiredApprovalCalls, 0);
  assert.deepEqual(await packages.approveApplicationPackages(userId, [{
    packageId: beforeRenewal.package_id, selectedRecipient: "jobs@expiry.test",
  }], noQueue), { approved: 1, queued: 1 });
  const renewed = (await client.query<{ approval_id: string; status: string; ordinal: number }>(
    `select approval_id,status,current_invocation_ordinal ordinal
     from application_mail_attempts where id=$1`, [expiredAttemptId],
  )).rows[0];
  assert.notEqual(renewed?.approval_id, beforeRenewal.approval_id);
  assert.deepEqual({ status: renewed?.status, ordinal: renewed?.ordinal }, { status: "queued", ordinal: 0 });
  const renewedFetch: typeof fetch = async (request) => {
    const url = String(request);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      return new Response(JSON.stringify({ id: "renewed-approval-id" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected_provider_request:${url}`);
  };
  assert.equal(await mail.dispatchApplicationAttempt(expiredAttemptId, renewedFetch), "provider_accepted");

  const pausedAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-paused", company: "Paused Fixture", companyDomain: "paused.test",
    recipient: "jobs@paused.test",
  });
  await campaigns.updateCampaign(userId, apply.id, { action: "pause" });
  let pausedCalls = 0;
  assert.equal(await mail.dispatchApplicationAttempt(pausedAttemptId, async () => {
    pausedCalls += 1;
    throw new Error("provider must not be called");
  }), "blocked");
  assert.equal(pausedCalls, 0);
  await campaigns.updateCampaign(userId, apply.id, { action: "resume" });

  const postBoundaryAttemptId = await prepareSyntheticAttempt({
    externalId: "product-designer-post-boundary", company: "Boundary Fixture", companyDomain: "boundary.test",
    recipient: "jobs@boundary.test",
  });
  let postBoundarySendCalls = 0;
  const postBoundaryFetch: typeof fetch = async (request) => {
    const url = String(request);
    if (url === "https://oauth2.googleapis.com/token") {
      await campaigns.updateCampaign(userId, apply.id, { action: "pause" });
      return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      postBoundarySendCalls += 1;
      return new Response(JSON.stringify({ id: "post-boundary-id" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected_provider_request:${url}`);
  };
  assert.equal(await mail.dispatchApplicationAttempt(postBoundaryAttemptId, postBoundaryFetch), "provider_accepted");
  assert.equal(postBoundarySendCalls, 1);
  await campaigns.updateCampaign(userId, apply.id, { action: "resume" });

  const oauth = await import("../lib/mail/oauth-transaction");
  const oauthUserId = await createUser("oauth-integration@example.test");
  const oauthMaterial = await oauth.beginOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-a",
    redirectUri: config.gmail.redirectUri, config,
  });
  assert.equal(oauth.oauthNonceMatches(createHash("sha256")
    .update(`rolesharp-oauth-nonce-v1\0${oauthMaterial.nonce}`, "utf8").digest("hex"), oauthMaterial.nonce), true);
  await assert.rejects(oauth.consumeOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "wrong-session",
    state: oauthMaterial.state, redirectUri: config.gmail.redirectUri, config,
  }), (error: unknown) => error instanceof oauth.OAuthTransactionError && error.code === "oauth_session");
  const consumed = await oauth.consumeOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-a",
    state: oauthMaterial.state, redirectUri: config.gmail.redirectUri, config,
  });
  assert.equal(consumed.codeVerifier, oauthMaterial.codeVerifier);
  assert.equal(oauth.oauthNonceMatches(consumed.nonceHash, oauthMaterial.nonce), true);
  await assert.rejects(oauth.consumeOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-a",
    state: oauthMaterial.state, redirectUri: config.gmail.redirectUri, config,
  }), (error: unknown) => error instanceof oauth.OAuthTransactionError && error.code === "oauth_replay");
  const tombstone = (await client.query<{ created_at: Date; retain_until: Date }>(
    "select created_at,retain_until from oauth_state_tombstones order by created_at desc limit 1",
  )).rows[0];
  assert.equal(tombstone?.retain_until.getTime() - tombstone?.created_at.getTime(), 24 * 3600_000);
  // PostgreSQL keeps microseconds while JavaScript Date is millisecond-precision.
  assert.deepEqual(await oauth.cleanupOAuthTransactions(new Date(tombstone.retain_until.getTime() + 1)), {
    expired: 0, tombstones: 1,
  });
  const expiredMaterial = await oauth.beginOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-expired",
    redirectUri: config.gmail.redirectUri, now: new Date(Date.now() - 3600_000), config,
  });
  await assert.rejects(oauth.consumeOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-expired",
    state: expiredMaterial.state, redirectUri: config.gmail.redirectUri, config,
  }), (error: unknown) => error instanceof oauth.OAuthTransactionError && error.code === "oauth_expired");
  await assert.rejects(oauth.beginOAuthTransaction({
    userId: oauthUserId, provider: "google", sessionBinding: "session-bad-redirect",
    redirectUri: "https://attacker.test/callback", config,
  }), (error: unknown) => error instanceof oauth.OAuthTransactionError && error.code === "oauth_redirect");

  const schedulerNoQueue = async () => undefined;
  const springUser = await createUser("dst-spring@example.test");
  const springProfile = await profiles.createCareerProfileVersion(springUser, {
    desiredTitles: ["Product Designer"], skills: [], acceptedTracks: ["individual"], locations: [],
    remotePolicies: [], authorization: "unknown", workTypes: [],
  }) as { id: string };
  const springCampaign = await campaigns.createCampaign(springUser, {
    mode: "daily_matches", authorizationMode: "review_each", status: "active",
    profileVersionId: springProfile.id, criteria: { ...criteria, countries: [], locations: [] },
    timezone: "America/New_York", dailyTime: "02:30", dailyLimit: 10,
    fitScoreFloor: 70, confidenceScoreFloor: 60,
  }) as { id: string };
  await scheduler.scheduleDueWorkflowItems(new Date("2026-03-08T06:59:00.000Z"), schedulerNoQueue, schedulerNoQueue, schedulerNoQueue);
  assert.equal((await client.query<{ count: number }>(
    "select count(*)::int count from job_work_items where kind='jobs_match' and dedupe_key like $1",
    [`${springCampaign.id}:%:match`],
  )).rows[0]?.count, 0);
  await scheduler.scheduleDueWorkflowItems(new Date("2026-03-08T07:00:00.000Z"), schedulerNoQueue, schedulerNoQueue, schedulerNoQueue);
  await scheduler.scheduleDueWorkflowItems(new Date("2026-03-08T08:00:00.000Z"), schedulerNoQueue, schedulerNoQueue, schedulerNoQueue);
  assert.equal((await client.query<{ count: number }>(
    "select count(*)::int count from job_work_items where kind='jobs_match' and dedupe_key like $1",
    [`${springCampaign.id}:%:match`],
  )).rows[0]?.count, 1);

  const fallUser = await createUser("dst-fall@example.test");
  const fallProfile = await profiles.createCareerProfileVersion(fallUser, {
    desiredTitles: ["Product Designer"], skills: [], acceptedTracks: ["individual"], locations: [],
    remotePolicies: [], authorization: "unknown", workTypes: [],
  }) as { id: string };
  const fallCampaign = await campaigns.createCampaign(fallUser, {
    mode: "daily_matches", authorizationMode: "review_each", status: "active",
    profileVersionId: fallProfile.id, criteria: { ...criteria, countries: [], locations: [] },
    timezone: "America/New_York", dailyTime: "01:30", dailyLimit: 10,
    fitScoreFloor: 70, confidenceScoreFloor: 60,
  }) as { id: string };
  await scheduler.scheduleDueWorkflowItems(new Date("2026-11-01T05:30:00.000Z"), schedulerNoQueue, schedulerNoQueue, schedulerNoQueue);
  await scheduler.scheduleDueWorkflowItems(new Date("2026-11-01T06:30:00.000Z"), schedulerNoQueue, schedulerNoQueue, schedulerNoQueue);
  assert.equal((await client.query<{ count: number }>(
    "select count(*)::int count from job_work_items where kind='jobs_match' and dedupe_key like $1",
    [`${fallCampaign.id}:%:match`],
  )).rows[0]?.count, 1);

  await campaigns.updateCampaign(userId, daily.id, { timezone: "Asia/Tokyo" });
  const stagedTimezone = (await client.query<{ timezone: string; pending_timezone: string; next_timezone_activation_date: string }>(
    "select timezone,pending_timezone,next_timezone_activation_date::text from job_campaigns where id=$1", [daily.id],
  )).rows[0];
  assert.deepEqual({ current: stagedTimezone?.timezone, pending: stagedTimezone?.pending_timezone }, {
    current: "UTC", pending: "Asia/Tokyo",
  });
  await scheduler.scheduleDueWorkflowItems(
    new Date(`${stagedTimezone?.next_timezone_activation_date}T00:00:00.000Z`),
    schedulerNoQueue, schedulerNoQueue, schedulerNoQueue,
  );
  assert.equal((await client.query<{ timezone: string }>(
    "select timezone from job_campaigns where id=$1", [daily.id],
  )).rows[0]?.timezone, "Asia/Tokyo");
}

async function main(): Promise<void> {
  await client.connect();
  await resetDatabase(false);
  await verifyExistingContracts();
  await verifyDeliveryAndPaymentRecovery();
  await verifyResumeOwnershipConflict();
  await verifyDeletionRetentionBoundary();
  await verifyJobWorkflowContracts();
  await verifyJobsWorkflowServiceIntegration();
  await verifyPackageBackedResumeDeletion();
  const firstDigest = await schemaDigest();
  await verifyMigrationFailureSafety(firstDigest);
  for (const name of (await migrationNames()).filter((candidate) => candidate >= "030_")) {
    await applyMigration(name);
  }
  assert.equal(await schemaDigest(), firstDigest);
  await resetDatabase(false);
  await verifyJobWorkflowContracts();
  await resetDatabase(true);
  const legacy = await client.query<{ canonical_job_key: string | null; company: string; resume_user_id: string | null }>(
    `select a.canonical_job_key,a.company,r.user_id::text resume_user_id
     from applications a join resumes r on r.id=a.resume_id
     where a.id='30000000-0000-4000-8000-000000000001'`,
  );
  assert.deepEqual(legacy.rows[0], {
    canonical_job_key: null,
    company: "Example '; drop table users; --",
    resume_user_id: "10000000-0000-4000-8000-000000000001",
  });
  console.log(`database integrity checks passed; schema sha256=${await schemaDigest()}`);
}

main().then(
  async () => {
    await client.end();
  },
  async (error: unknown) => {
    console.error(error instanceof Error ? error.stack : String(error));
    await client.end();
    process.exitCode = 1;
  },
);
