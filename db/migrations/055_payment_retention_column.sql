-- Account deletion used to DELETE the crypto_payments row outright, which
-- erased the accounting record of money actually received along with the
-- person. The privacy policy already reserves "narrowly justified legal,
-- security, fraud, or accounting retention", so the row now survives with every
-- account identifier stripped instead (lib/db.ts).
--
-- Only the column shape lives here. The redaction itself is application code
-- because it also has to rewrite order_id: that column embeds the user id
-- (`${plan}_${userId}_${uuid}`, lib/crypto-payments.ts), so nulling
-- user_id_text alone would leave the account trivially re-identifiable from the
-- order reference and the erasure would be cosmetic.
--
-- Kept transactional and separate from 057: that file cannot run inside a
-- transaction, and DDL that can roll back should not forfeit the ability to.
alter table crypto_payments alter column user_id_text drop not null;

-- resumes_user_text_week_idx (007) and resumes_user_text_idx (003) are the same
-- index on (user_id_text, created_at desc). Two identical indexes cost double
-- on every write and buy nothing on read. Keep the older name, which is the one
-- 003 established and the quota reads were written against.
drop index if exists resumes_user_text_week_idx;
