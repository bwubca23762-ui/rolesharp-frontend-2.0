-- Account erasure must not fail because another user was referred by the
-- deleting account. The application also nulls this reference transactionally;
-- ON DELETE SET NULL makes the invariant hold for every deletion path.
alter table users drop constraint if exists users_referred_by_fkey;
alter table users
  add constraint users_referred_by_fkey
  foreign key (referred_by) references users(id) on delete set null;
