-- Staff identity, RoleSharp RBAC, and per-user high-risk feature approval.
-- Expand-only: existing password + TOTP admin auth remains available as an
-- audited break-glass path until the application adopts staff sessions.

create extension if not exists pgcrypto;

create table if not exists staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  google_subject text unique check (
    google_subject is null or (google_subject = btrim(google_subject) and google_subject <> '')
  ),
  display_name text check (
    display_name is null or char_length(btrim(display_name)) between 1 and 160
  ),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'revoked')),
  auth_version integer not null default 1 check (auth_version > 0),
  allowed_domain text check (
    allowed_domain is null or (
      allowed_domain = lower(btrim(allowed_domain))
      and allowed_domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
    )
  ),
  invited_by uuid references staff_accounts(id),
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'invited' and activated_at is null and suspended_at is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and suspended_at is null and revoked_at is null)
    or (status = 'suspended' and activated_at is not null and suspended_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table if not exists staff_roles (
  role_key text primary key check (role_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  owner_only boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists staff_permissions (
  permission_key text primary key check (permission_key ~ '^[a-z][a-z0-9_.]{2,95}$'),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists staff_role_permissions (
  role_key text not null references staff_roles(role_key) on delete cascade,
  permission_key text not null references staff_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists staff_role_assignments (
  staff_account_id uuid not null references staff_accounts(id) on delete cascade,
  role_key text not null references staff_roles(role_key),
  assigned_by uuid references staff_accounts(id),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references staff_accounts(id),
  reason text check (reason is null or char_length(reason) <= 500),
  check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null and revoked_at >= assigned_at)
  ),
  primary key (staff_account_id, role_key, assigned_at)
);

create unique index if not exists staff_role_assignments_active_unique
  on staff_role_assignments (staff_account_id, role_key)
  where revoked_at is null;

create table if not exists staff_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  nonce_hash text not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  browser_binding_hash text not null check (browser_binding_hash ~ '^[0-9a-f]{64}$'),
  return_path text not null check (
    return_path ~ '^/admin(?:[/?#][^[:cntrl:]]*)?$'
    and char_length(return_path) <= 500
  ),
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (
    (status = 'pending' and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null and consumed_at <= expires_at)
    or (status = 'expired' and consumed_at is null)
  )
);

create table if not exists staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_account_id uuid not null references staff_accounts(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  auth_version integer not null check (auth_version > 0),
  authentication_method text not null check (authentication_method in ('google', 'break_glass')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references staff_accounts(id),
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) <= 500),
  check (last_seen_at >= created_at and last_seen_at <= absolute_expires_at),
  check (idle_expires_at > last_seen_at and absolute_expires_at > created_at),
  check (idle_expires_at <= absolute_expires_at),
  check (absolute_expires_at <= created_at + interval '8 hours'),
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revocation_reason is not null)
  )
);

create index if not exists staff_sessions_account_active_idx
  on staff_sessions (staff_account_id, absolute_expires_at desc)
  where revoked_at is null;

create table if not exists staff_login_events (
  id bigint generated always as identity primary key,
  staff_account_id uuid references staff_accounts(id) on delete set null,
  normalized_email text check (
    normalized_email is null or (
      normalized_email = lower(btrim(normalized_email))
      and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
    )
  ),
  authentication_method text not null check (authentication_method in ('google', 'break_glass')),
  outcome text not null check (outcome in ('succeeded', 'denied', 'failed', 'revoked')),
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{2,80}$'),
  request_evidence_digest text check (
    request_evidence_digest is null or request_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now()
);

create index if not exists staff_login_events_created_idx on staff_login_events (created_at desc);
create index if not exists staff_login_events_account_idx on staff_login_events (staff_account_id, created_at desc);

insert into staff_roles (role_key, label, description, owner_only) values
  ('owner', 'Owner', 'Full platform control including staff identity and break-glass operations.', true),
  ('admin', 'Admin', 'Broad platform operations excluding owner-only identity and recovery actions.', false),
  ('operations', 'Operations', 'Jobs, workflows, access approvals, and system operations.', false),
  ('support', 'Support', 'User support and privacy-limited account diagnostics.', false),
  ('finance', 'Finance', 'Payments, refunds, and revenue operations without resume content access.', false),
  ('content', 'Content', 'Content, offer, legal-draft, and notification editing.', false),
  ('analyst', 'Analyst', 'Read-only analytics and bounded exports.', false),
  ('security_auditor', 'Security auditor', 'Read-only audit, security, and service-health access.', false)
on conflict (role_key) do nothing;

insert into staff_permissions (permission_key, description) values
  ('admin.access', 'Access the staff control plane.'),
  ('analytics.read', 'Read privacy-bounded analytics.'),
  ('analytics.export', 'Create bounded privacy-safe analytics exports.'),
  ('users.read', 'Read privacy-limited user account summaries.'),
  ('users.manage', 'Manage user account state and non-owner entitlements.'),
  ('staff.read', 'Read staff accounts, roles, and login history.'),
  ('staff.manage', 'Invite, suspend, revoke, and assign staff roles.'),
  ('access.read', 'Read user feature-access requests and grants.'),
  ('access.manage', 'Approve, suspend, revoke, and cap high-risk user features.'),
  ('legal.read', 'Read legal documents, versions, and acceptance summaries.'),
  ('legal.edit', 'Create and edit draft legal versions.'),
  ('legal.publish', 'Schedule or publish immutable legal versions.'),
  ('offers.read', 'Read offers, claims, and version distribution.'),
  ('offers.edit', 'Create and edit draft offers.'),
  ('offers.publish', 'Publish immutable offer versions.'),
  ('notifications.read', 'Read publication and delivery status.'),
  ('notifications.edit', 'Create and edit draft in-app publications.'),
  ('notifications.publish', 'Publish immutable in-app notifications.'),
  ('communications.read', 'Read privacy-bounded campaign delivery reports.'),
  ('communications.edit', 'Create and test communication campaigns.'),
  ('communications.publish', 'Schedule, publish, pause, or cancel communications.'),
  ('payments.read', 'Read settled payment and refund data.'),
  ('payments.manage', 'Perform bounded payment and refund operations.'),
  ('support.read', 'Read support cases.'),
  ('support.manage', 'Respond to and update support cases.'),
  ('content.read', 'Read content and generation-job status.'),
  ('content.edit', 'Create or edit content drafts.'),
  ('content.publish', 'Publish content.'),
  ('jobs.read', 'Read jobs and workflow operations.'),
  ('jobs.manage', 'Operate job ingestion and workflow controls.'),
  ('mail.read', 'Read redacted mailbox and send-attempt diagnostics.'),
  ('system.read', 'Read service, queue, cache, migration, and backup health.'),
  ('system.manage', 'Perform bounded operational system actions.'),
  ('security.read', 'Read audit, authentication, rate-limit, and security signals.'),
  ('security.manage', 'Manage security controls and revoke active sessions.'),
  ('flags.manage', 'Manage allowlisted feature flags.'),
  ('break_glass.manage', 'Use and administer owner recovery controls.')
on conflict (permission_key) do nothing;

insert into staff_role_permissions (role_key, permission_key)
select 'owner', permission_key from staff_permissions
on conflict do nothing;

insert into staff_role_permissions (role_key, permission_key) values
  ('admin','admin.access'),('admin','analytics.read'),('admin','analytics.export'),
  ('admin','users.read'),('admin','users.manage'),('admin','staff.read'),
  ('admin','access.read'),('admin','access.manage'),('admin','legal.read'),
  ('admin','legal.edit'),('admin','legal.publish'),('admin','offers.read'),
  ('admin','offers.edit'),('admin','offers.publish'),('admin','notifications.read'),
  ('admin','notifications.edit'),('admin','notifications.publish'),('admin','communications.read'),
  ('admin','communications.edit'),('admin','communications.publish'),('admin','payments.read'),
  ('admin','payments.manage'),('admin','support.read'),('admin','support.manage'),
  ('admin','content.read'),('admin','content.edit'),('admin','content.publish'),
  ('admin','jobs.read'),('admin','jobs.manage'),('admin','mail.read'),
  ('admin','system.read'),('admin','system.manage'),('admin','security.read'),('admin','flags.manage'),
  ('operations','admin.access'),('operations','analytics.read'),('operations','users.read'),
  ('operations','access.read'),('operations','access.manage'),('operations','jobs.read'),
  ('operations','jobs.manage'),('operations','mail.read'),('operations','system.read'),
  ('operations','system.manage'),('operations','flags.manage'),
  ('support','admin.access'),('support','users.read'),('support','support.read'),
  ('support','support.manage'),('support','access.read'),
  ('finance','admin.access'),('finance','analytics.read'),('finance','payments.read'),
  ('finance','payments.manage'),
  ('content','admin.access'),('content','legal.read'),('content','legal.edit'),
  ('content','offers.read'),('content','offers.edit'),('content','notifications.read'),
  ('content','notifications.edit'),('content','communications.read'),
  ('content','communications.edit'),('content','content.read'),('content','content.edit'),
  ('analyst','admin.access'),('analyst','analytics.read'),('analyst','analytics.export'),
  ('security_auditor','admin.access'),('security_auditor','security.read'),
  ('security_auditor','system.read'),('security_auditor','staff.read'),
  ('security_auditor','analytics.read')
on conflict do nothing;

create table if not exists feature_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  feature_key text not null check (feature_key in (
    'daily_matches', 'role_apply_prepare', 'role_apply_gmail', 'role_apply_microsoft'
  )),
  state text not null default 'requested' check (state in (
    'requested', 'approved', 'suspended', 'revoked', 'expired'
  )),
  daily_cap integer check (daily_cap is null or daily_cap between 1 and 5),
  provider_limit integer check (provider_limit is null or provider_limit between 1 and 5),
  reason text check (reason is null or char_length(reason) <= 1000),
  risk_notes text check (risk_notes is null or char_length(risk_notes) <= 2000),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references staff_accounts(id),
  expires_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > requested_at),
  check (
    (state = 'requested' and approved_at is null and approved_by is null and suspended_at is null and revoked_at is null)
    or (state = 'approved' and approved_at is not null and approved_by is not null and suspended_at is null and revoked_at is null)
    or (state = 'suspended' and approved_at is not null and approved_by is not null and suspended_at is not null and revoked_at is null)
    or (state = 'revoked' and revoked_at is not null)
    or (state = 'expired' and approved_at is not null and approved_by is not null and expires_at is not null)
  ),
  unique (user_id, feature_key),
  unique (id, user_id)
);

create index if not exists feature_access_grants_state_idx
  on feature_access_grants (feature_key, state, updated_at desc);

create table if not exists feature_access_events (
  id bigint generated always as identity primary key,
  grant_id uuid not null,
  user_id uuid not null,
  feature_key text not null check (feature_key in (
    'daily_matches', 'role_apply_prepare', 'role_apply_gmail', 'role_apply_microsoft'
  )),
  previous_state text check (previous_state is null or previous_state in (
    'requested', 'approved', 'suspended', 'revoked', 'expired'
  )),
  new_state text not null check (new_state in (
    'requested', 'approved', 'suspended', 'revoked', 'expired'
  )),
  actor_kind text not null check (actor_kind in ('user', 'staff', 'system', 'break_glass')),
  actor_staff_id uuid references staff_accounts(id),
  reason text check (reason is null or char_length(reason) <= 1000),
  grant_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (grant_id, user_id) references feature_access_grants(id, user_id) on delete cascade,
  check (
    (actor_kind = 'staff' and actor_staff_id is not null)
    or (actor_kind in ('user', 'system', 'break_glass') and actor_staff_id is null)
  )
);

create index if not exists feature_access_events_grant_idx
  on feature_access_events (grant_id, created_at desc);
create index if not exists feature_access_events_user_idx
  on feature_access_events (user_id, created_at desc);

alter table admin_actions add column if not exists staff_account_id uuid references staff_accounts(id);
alter table admin_actions add column if not exists authentication_method text;
alter table admin_actions add column if not exists request_evidence_digest text;
alter table admin_actions drop constraint if exists admin_actions_authentication_method_check;
alter table admin_actions add constraint admin_actions_authentication_method_check check (
  authentication_method is null or authentication_method in ('google', 'break_glass', 'system')
);
alter table admin_actions drop constraint if exists admin_actions_request_evidence_check;
alter table admin_actions add constraint admin_actions_request_evidence_check check (
  request_evidence_digest is null or request_evidence_digest ~ '^[0-9a-f]{64}$'
);

create or replace function reject_append_only_identity_event()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists staff_login_events_append_only on staff_login_events;
create trigger staff_login_events_append_only
before update or delete on staff_login_events
for each row execute function reject_append_only_identity_event();

drop trigger if exists feature_access_events_append_only on feature_access_events;
create trigger feature_access_events_append_only
before update or delete on feature_access_events
for each row
when (pg_trigger_depth() = 0)
execute function reject_append_only_identity_event();

drop trigger if exists admin_actions_append_only on admin_actions;
create trigger admin_actions_append_only
before update or delete on admin_actions
for each row execute function reject_append_only_identity_event();
