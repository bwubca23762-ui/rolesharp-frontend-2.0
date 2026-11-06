# RoleSharp security

## Reporting a vulnerability

Please report suspected vulnerabilities privately to `support@rolesharp.com`.
Include the affected URL or route, a minimal reproduction, impact, and whether
any personal data was accessed. Do not include passwords, payment secrets,
reset links, authenticator secrets, or unrelated user data in a report.

We will acknowledge reports as soon as practical, investigate reproducible
issues, and coordinate disclosure with the reporter. Please do not perform
denial-of-service testing, social engineering, credential attacks against
other users, or access data that is not yours.

## Deployment security invariants

- Production requires HTTPS, `AUTH_SECRET`, `ADMIN_PASSWORD`, and
  `ADMIN_TOTP_SECRET`; admin MFA fails closed when its secret is absent.
- Database migrations run in filename order, including account-erasure and
  referral foreign-key migrations.
- Payment webhooks must be provider-signed and match the local order, expected
  USD amount, and final paid status before entitlement is granted.
- Original resume uploads are parsed from bounded temporary files; saved
  extracted resume content follows the account deletion policy.

## Data and retention

The public [privacy policy](/privacy) describes account, resume, payment,
support, provider, deletion, and limited fraud-prevention retention. Production
operators must keep proxy logs, backups, crash dumps, and provider settings
consistent with that notice and must not store secrets in source control.
