-- Follow-up drafts (Phase 5). follow_up_at already existed as a manual "nudge
-- me on" field; the follow-up feature needs to know how many have been sent
-- so the two-per-application cap is enforceable in SQL, not in memory.
alter table applications add column if not exists follow_up_count int not null default 0;
