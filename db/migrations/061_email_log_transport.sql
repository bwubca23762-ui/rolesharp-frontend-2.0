-- Bulk mail stream: record which transport delivered each email_log row.
-- Transactional mail (verification, receipts) stays on the Cloudflare
-- transport with its own 200/day budget; bulk sends (job alerts, daily
-- matches) go through the numbered SMTP pool and must be observable
-- per-account, so the log gains a nullable transport tag
-- ("cloudflare" | "smtp" | "bulk:1" | "bulk:2" | ...).
alter table email_log add column if not exists transport text;
