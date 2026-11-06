# Microsoft mailbox app registration

Register a dedicated Microsoft identity-platform web application using the configured `common` tenant policy for supported personal and work accounts. Do not reuse login credentials and do not grant application-wide tenant mail permission.

Configure the exact HTTPS callback `/api/mail-connections/microsoft/callback`. Request delegated permissions only:

```text
openid profile email offline_access User.Read Mail.Send
```

`User.Read` is used only for Graph `/me` basic identity confirmation. The connected sender must come from a syntactically valid `/me.mail`; RoleSharp never falls back to `userPrincipalName`, token email claims, or user-entered sender text. `Mail.Send` is used only for a qualifying application email. No inbox, contacts, calendar, or mailbox-read permission is requested.

The connection screen must link users to Microsoft My Apps for consent removal without claiming that Microsoft offers Google-style granular token revocation. Local disconnect and account deletion always erase RoleSharp's credential first, even when Microsoft is unavailable.

