begin;

create extension if not exists pg_trgm;

create index if not exists customers_full_name_search_idx
  on public.customers using gin (lower(full_name) gin_trgm_ops)
  where archived_at is null;
create index if not exists jobs_name_search_idx
  on public.jobs using gin (lower(customer_name) gin_trgm_ops)
  where archived_at is null;
create index if not exists jobs_qf_number_search_idx
  on public.jobs using gin (lower(qfloors_job_number) gin_trgm_ops)
  where archived_at is null and qfloors_job_number is not null;
create index if not exists job_tasks_title_search_idx
  on public.job_tasks using gin (lower(title) gin_trgm_ops);
create index if not exists employees_name_search_idx
  on public.employees using gin (lower(name) gin_trgm_ops)
  where active = true;
create index if not exists job_attachments_file_name_search_idx
  on public.job_attachments using gin (lower(file_name) gin_trgm_ops)
  where archived_at is null;

commit;
