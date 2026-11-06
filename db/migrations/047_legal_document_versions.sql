-- Immutable legal document versions and exact-version user acceptance receipts.
-- The seeded v1 documents establish the deployment baseline without falsely
-- claiming that pre-existing accounts accepted terms they never saw.

create extension if not exists pgcrypto;

create table if not exists legal_documents (
  document_key text primary key check (document_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  required_at_signup boolean not null default true,
  acceptance_required_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null references legal_documents(document_key),
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'superseded')),
  body_markdown text not null check (char_length(body_markdown) between 20 and 200000),
  change_summary text not null check (char_length(btrim(change_summary)) between 3 and 2000),
  material_change boolean not null default false,
  effective_at timestamptz not null,
  published_at timestamptz,
  created_by uuid references staff_accounts(id) on delete set null,
  published_by uuid references staff_accounts(id) on delete set null,
  content_digest text not null check (
    content_digest ~ '^[0-9a-f]{64}$'
    and content_digest = encode(digest(convert_to(body_markdown, 'UTF8'), 'sha256'), 'hex')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_key, version_number),
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status in ('scheduled', 'published', 'superseded') and published_at is not null)
  ),
  check (published_at is null or effective_at >= created_at - interval '1 minute')
);

create index if not exists legal_document_versions_current_idx
  on legal_document_versions (document_key, effective_at desc, version_number desc)
  where status in ('scheduled', 'published');

create table if not exists legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  document_key text not null references legal_documents(document_key),
  legal_version_id uuid not null references legal_document_versions(id),
  version_number integer not null check (version_number > 0),
  content_digest_snapshot text not null check (content_digest_snapshot ~ '^[0-9a-f]{64}$'),
  acceptance_surface text not null check (acceptance_surface in (
    'email_signup', 'google_signup', 'legal_notice', 'settings', 'api'
  )),
  request_evidence_digest text not null check (request_evidence_digest ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  unique (user_id, legal_version_id),
  foreign key (document_key, version_number)
    references legal_document_versions(document_key, version_number)
);

create index if not exists legal_acceptances_user_document_idx
  on legal_acceptances (user_id, document_key, version_number desc, accepted_at desc);

create or replace function enforce_legal_version_contract()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'published legal versions are immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'scheduled', 'published') then
    raise exception 'invalid legal version status transition' using errcode = '23514';
  end if;
  if old.status <> 'draft' then
    if not (
      (old.status = 'scheduled' and new.status in ('scheduled', 'published', 'superseded'))
      or (old.status = 'published' and new.status in ('published', 'superseded'))
      or (old.status = 'superseded' and new.status = 'superseded')
    ) then
      raise exception 'invalid legal version status transition' using errcode = '23514';
    end if;
    if new.document_key <> old.document_key
       or new.version_number <> old.version_number
       or new.body_markdown <> old.body_markdown
       or new.change_summary <> old.change_summary
       or new.material_change <> old.material_change
       or new.effective_at <> old.effective_at
       or new.content_digest <> old.content_digest
       or new.created_by is distinct from old.created_by
       or new.published_by is distinct from old.published_by
       or new.published_at is distinct from old.published_at
       or new.created_at <> old.created_at then
      raise exception 'published legal version content is immutable' using errcode = '55000';
    end if;
  end if;
  if new.document_key <> old.document_key or new.version_number <> old.version_number then
    raise exception 'legal version identity is immutable' using errcode = '55000';
  end if;
  if new.content_digest <> encode(digest(convert_to(new.body_markdown, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'legal version digest mismatch' using errcode = '23514';
  end if;
  if new.status in ('scheduled', 'published') and new.published_at is null then
    raise exception 'published legal version metadata is incomplete' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists legal_document_versions_contract on legal_document_versions;
create trigger legal_document_versions_contract
before update or delete on legal_document_versions
for each row execute function enforce_legal_version_contract();

create or replace function validate_legal_acceptance_snapshot()
returns trigger language plpgsql as $$
declare
  version_row legal_document_versions%rowtype;
begin
  select * into version_row from legal_document_versions where id = new.legal_version_id;
  if version_row.id is null
     or version_row.document_key <> new.document_key
     or version_row.version_number <> new.version_number
     or version_row.content_digest <> new.content_digest_snapshot
     or version_row.status not in ('scheduled', 'published')
     or version_row.effective_at > new.accepted_at then
    raise exception 'legal acceptance version mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists legal_acceptances_snapshot on legal_acceptances;
create trigger legal_acceptances_snapshot
before insert on legal_acceptances
for each row execute function validate_legal_acceptance_snapshot();

drop trigger if exists legal_acceptances_append_only on legal_acceptances;
create trigger legal_acceptances_append_only
before update or delete on legal_acceptances
for each row
when (pg_trigger_depth() = 0)
execute function reject_append_only_identity_event();

insert into legal_documents
  (document_key, title, description, required_at_signup, acceptance_required_from)
values
  ('terms', 'Terms of Service', 'Rules for using RoleSharp products and services.', true, now()),
  ('privacy', 'Privacy Policy', 'How RoleSharp processes and protects personal data.', true, now())
on conflict (document_key) do nothing;

with seed(document_key, version_number, body_markdown, change_summary) as (
  values
  ('terms', 1, $terms$
## Use of the service

RoleSharp provides resume checking, resume generation, exports, job matching, and related job-search writing tools. Users are responsible for reviewing generated content before applying.

## Accounts and limits

Free and Premium plans have usage limits. Abuse, automation, or attempts to bypass limits may result in account restriction.

## Generated content

AI output may require editing. Do not include false claims, confidential employer data, or sensitive personal information that is not needed for a job application.

## Daily Matches and application email

Daily Matches may send one digest of up to ten newly matched jobs per local day. RoleSharp Apply is limited to postings that explicitly accept an application by email and expose a source-backed recipient. It does not complete LinkedIn, Indeed, or employer ATS forms, answer screening questions, infer recruiter addresses, or guarantee an interview.

You must review profile facts, campaign criteria, connected sender, and every review-each package before authorization. Provider acceptance does not prove delivery. Unknown outcomes are not automatically resent. A provider call that crossed the durable sending boundary cannot be recalled.

## Community safety reports

Internship safety reports must be truthful, relevant, and based on information you reasonably believe is accurate. Do not post threats, harassment, fabricated accusations, credentials, government identifiers, or unrelated personal data. Moderation does not establish that an allegation is legally proven.

## Premium and payments

Premium access depends on successful payment or a valid offer or administrative grant. Feature availability may change, and payment or plan-specific terms shown at purchase also apply.

## Availability and termination

The service may be limited during maintenance, traffic spikes, provider outages, security incidents, or legal requirements. RoleSharp may restrict or terminate access for material misuse, fraud, security threats, or violation of these Terms.

## Disclaimers and responsibility

RoleSharp is a job-search aid, not an employer, recruiter, legal adviser, or guarantee of employment. To the extent permitted by applicable law, the service is provided without guarantees of uninterrupted availability or specific outcomes.

## Changes and contact

Material changes require a new exact-version acceptance before high-impact actions. Basic account access, support, privacy controls, export, and deletion remain available. Contact support@rolesharp.com with questions.
$terms$, 'Initial versioned baseline of the existing RoleSharp Terms.'),
  ('privacy', 1, $privacy$
## Information we process

RoleSharp processes account email and authentication data, resume and profile content, uploaded-file text extraction, target roles and companies, job descriptions, generated documents, product activity, subscriptions, payment metadata, support records, security logs, job-workflow records, and user choices.

## Purposes and legal bases

We use data to provide requested services, secure accounts, prevent abuse, administer purchases and offers, respond to support and legal requests, improve reliability, and comply with applicable obligations. Depending on context and jurisdiction, processing may rely on contract, consent, legitimate interests, or legal obligation.

## Providers and international processing

Infrastructure, email, payment, analytics, and AI providers receive only data needed for the relevant operation under their applicable terms. Processing locations may differ from your location and may involve lawful international transfers. RoleSharp does not sell personal data or intentionally train RoleSharp-owned models on resume content.

## Resume uploads and generated content

Uploaded files are used to extract text for scoring and generation. Saved profiles, generated resumes, application packages, and exports remain associated with the account until deleted under the applicable retention process.

## Jobs workflows and connected mailboxes

Daily Matches processes confirmed career-profile versions, campaign rules, job snapshots, fit evidence, and verified account-email versions. RoleSharp Apply stores immutable reviewed packages, posting-backed recipients, tailored attachments, approval receipts, attempt states, quota reservations, and redacted provider receipts.

Gmail and Microsoft connections are separate from login and use send-oriented delegated scopes. Gmail requests `openid`, `email`, offline access, and `https://www.googleapis.com/auth/gmail.send`. Microsoft requests delegated `openid`, `profile`, `email`, `offline_access`, `User.Read`, and `Mail.Send`; `User.Read` is used only to confirm basic account identity through Microsoft Graph `/me`. RoleSharp does not request inbox-read, mailbox-modify, contacts, application-wide tenant mail permissions, or mailbox passwords.

Connected refresh tokens are encrypted with a dedicated authenticated key and retained only while the connection remains enabled. Access tokens and authorization codes are transient and are not written to queue payloads or application logs. Disconnect first disables sending and erases the local refresh credential even if the provider is unavailable. RoleSharp then makes a best-effort Google token-revocation request; Microsoft users receive the Microsoft My Apps consent-removal path. Account deletion also disables every connection and erases local credentials.

## Notifications, campaigns, cookies, and analytics

RoleSharp may provide service, security, legal, account, and product notices in-app or by email. Promotional communications must respect applicable consent, preference, unsubscribe, bounce, and suppression controls. Essential cookies support authentication and security; analytics should be privacy-bounded and used for product and operational measurement.

## Retention and deletion

Retention depends on the record category and operational, security, accounting, fraud-prevention, or legal need. Active-account data is retained to provide the service. Terminal notification-outbox transport metadata is purged after 30 days. Pending OAuth transactions last no more than ten minutes, and consumed or expired state replay tombstones last exactly 24 hours. Account deletion removes user-linked profiles, matches, application packages, mailbox credentials, applications, calibration events, support records, internship reports and evidence, comments, votes, verification records, and processing reservations, subject only to narrowly justified legal, security, fraud, or accounting retention. The original checker upload is not intentionally saved, and temporary parser copies are cleaned up after processing.

## Security

Passwords are hashed, high-risk credentials are encrypted, administrative access is separated and audited, and operational logs should avoid secrets and unnecessary personal data. No system can guarantee absolute security.

## Your rights and choices

Depending on applicable law, you may request access, correction, deletion, restriction, portability, or objection, and may withdraw consent where processing relies on consent. Product controls support account updates, exports, privacy choices, mailbox disconnection, and deletion where available.

## Children and minimum age

RoleSharp is not directed to children who cannot lawfully consent to use of the service. Do not create an account if you are below the applicable minimum age without valid authorization.

## Contact and legal notices

For privacy questions, rights requests, escalation, or legal-notice handling, contact support@rolesharp.com or use the support form. Material policy changes require a new exact-version acceptance before high-impact actions while basic account and privacy controls remain available.
$privacy$, 'Initial versioned baseline of the existing RoleSharp Privacy Policy.')
)
insert into legal_document_versions
  (document_key, version_number, status, body_markdown, change_summary, material_change,
   effective_at, published_at, content_digest)
select document_key, version_number, 'published', btrim(body_markdown), change_summary, false,
  now(), now(), encode(digest(convert_to(btrim(body_markdown), 'UTF8'), 'sha256'), 'hex')
from seed
on conflict (document_key, version_number) do nothing;
