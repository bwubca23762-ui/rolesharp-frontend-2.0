-- Server-side logout. Until now POST /api/auth/logout expired the cookie and
-- nothing else, so the JWE it discarded stayed cryptographically valid for up
-- to its full 30-day cap. A token captured before logout survived the logout
-- that was supposed to kill it, and the only real revocation lever was bumping
-- users.auth_version on password change — which signs the user out everywhere.
--
-- Sessions carry a `sid` minted at login and preserved across the sliding
-- refresh (lib/auth.ts), so revoking one sid kills exactly one device's session
-- and every refreshed token descended from it, leaving other devices alone.
--
-- The row is only needed until the token it revokes would have expired anyway;
-- scripts/retention-purge.ts deletes past that point. Storing the sid rather
-- than the token means this table never holds anything that could be replayed
-- as a credential if it leaked.
create table if not exists revoked_sessions (
  session_id text primary key,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Purge support: the nightly job deletes by expires_at.
create index if not exists revoked_sessions_expires_idx on revoked_sessions (expires_at);
