-- Plan (monthly/yearly) + duration tracking for crypto payments.
alter table crypto_payments add column if not exists plan text default 'monthly';
alter table crypto_payments add column if not exists days int default 30;
