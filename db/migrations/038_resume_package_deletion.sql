-- A resume is user-owned personal data. Deleting it must also remove the
-- immutable application-package graph derived from that resume. Every child
-- relationship is explicit so the delete cannot stop midway on an immediate
-- foreign-key check.

alter table application_mail_attempts
  drop constraint if exists application_mail_attempts_package_id_user_id_canonical_job_fkey,
  drop constraint if exists application_mail_attempts_package_id_user_id_canonical_job_key_canonical_company_key_fkey,
  add constraint application_mail_attempts_package_id_user_id_canonical_job_key_canonical_company_key_fkey
    foreign key (package_id, user_id, canonical_job_key, canonical_company_key)
    references application_packages(id, user_id, canonical_job_key, canonical_company_key)
    on delete cascade;

alter table application_mail_attempts
  drop constraint if exists application_mail_attempts_approval_id_user_id_package_id_fkey,
  add constraint application_mail_attempts_approval_id_user_id_package_id_fkey
    foreign key (approval_id, user_id, package_id)
    references package_approvals(id, user_id, package_id)
    on delete cascade;

alter table package_approvals
  drop constraint if exists package_approvals_package_id_user_id_package_hash_fkey,
  add constraint package_approvals_package_id_user_id_package_hash_fkey
    foreign key (package_id, user_id, package_hash)
    references application_packages(id, user_id, package_hash)
    on delete cascade;

alter table application_packages
  drop constraint if exists application_packages_resume_id_user_id_fkey,
  add constraint application_packages_resume_id_user_id_fkey
    foreign key (resume_id, user_id)
    references resumes(id, user_id)
    on delete cascade;

create index if not exists application_packages_resume_owner_idx
  on application_packages(resume_id, user_id);
