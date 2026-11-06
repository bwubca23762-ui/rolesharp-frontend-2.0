# Google mailbox OAuth verification

Create a dedicated Google OAuth web application for connected mailbox sending. Do not reuse the RoleSharp login client.

Configure the exact callback `/api/mail-connections/gmail/callback` on the production HTTPS origin. Request only `openid`, `email`, offline access, and `https://www.googleapis.com/auth/gmail.send`. Do not request Gmail read, modify, labels, contacts, or broad mailbox scopes.

The consent and verification submission must explain:

- RoleSharp uses the verified ID-token identity to display and bind the connected sender.
- `gmail.send` is used only to send a user-approved or explicitly time-limited campaign application email.
- RoleSharp does not read the inbox and does not collect a mailbox password.
- Refresh tokens are authenticated-encrypted until disconnect or account deletion.
- Disconnect erases the local credential first and then attempts Google token revocation.
- A provider-accepted API response is shown as delivery unverified.

Verification evidence should include the connection screen, exact scope list, privacy-policy section, disconnect control, and a synthetic demonstration. Never record a real token, authorization code, recipient, resume, or message body.

