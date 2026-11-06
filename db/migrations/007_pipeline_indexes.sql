create index if not exists resumes_created_idx on resumes (created_at desc);
create index if not exists resumes_gen_ms_idx on resumes (gen_ms desc) where gen_ms is not null;
create index if not exists resumes_user_text_week_idx on resumes (user_id_text, created_at desc);
create index if not exists resumes_company_idx on resumes (company_id) where company_id is not null;
create index if not exists resumes_role_idx on resumes (role_id) where role_id is not null;
create index if not exists crypto_pay_status_idx on crypto_payments (status, created_at desc);
create index if not exists crypto_pay_plan_idx on crypto_payments (plan, created_at desc);
create index if not exists users_premium_until_idx on users (premium_until) where premium_until is not null;
