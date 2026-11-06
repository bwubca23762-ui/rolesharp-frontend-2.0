-- 074: mail.manage permission — operations staff were locked out of Mail
-- Connections because the route demanded communications.edit (campaign
-- authoring) while the role holds mail.read. `mail.manage` is the missing
-- narrow permission for disabling a user's mailbox connection.

insert into staff_permissions (permission_key, description)
values ('mail.manage', 'Disable a user''s mailbox connection from the admin panel.')
on conflict (permission_key) do nothing;

insert into staff_role_permissions (role_key, permission_key)
values ('admin', 'mail.manage'), ('operations', 'mail.manage')
on conflict do nothing;
