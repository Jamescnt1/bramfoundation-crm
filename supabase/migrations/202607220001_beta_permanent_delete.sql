-- TEMPORARY BETA CLEANUP HELPERS.
-- TODO(BETA): Drop these functions and restore archive-only UI after beta cleanup.
-- These functions are callable only with the service-role key. They keep each
-- relational cleanup atomic while application code removes returned Storage objects.

create or replace function public.beta_permanently_delete_job(target_job_id uuid)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_paths text[];
begin
  if not exists (select 1 from public.jobs where id = target_job_id) then
    raise exception 'Job not found.';
  end if;

  select coalesce(array_agg(ja.storage_path), array[]::text[])
    into stored_paths
  from public.job_attachments ja
  where ja.job_id = target_job_id;

  delete from public.customer_emails where job_id = target_job_id;
  delete from public.conversations where job_id = target_job_id;
  delete from public.job_tasks where job_id = target_job_id;
  delete from public.appointments where job_id = target_job_id;
  delete from public.job_activities where job_id = target_job_id;
  delete from public.job_attachments where job_id = target_job_id;
  delete from public.jobs where id = target_job_id;

  return query select unnest(stored_paths);
end;
$$;

create or replace function public.beta_permanently_delete_customer(target_customer_id uuid)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_paths text[];
begin
  if not exists (select 1 from public.customers where id = target_customer_id) then
    raise exception 'Customer not found.';
  end if;

  select coalesce(array_agg(ja.storage_path), array[]::text[])
    into stored_paths
  from public.job_attachments ja
  join public.jobs j on j.id = ja.job_id
  where j.customer_id = target_customer_id;

  delete from public.customer_emails
  where job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.conversations
  where job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.job_tasks
  where customer_id = target_customer_id
     or job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.appointments
  where job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.job_activities
  where job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.job_attachments
  where job_id in (select id from public.jobs where customer_id = target_customer_id);

  delete from public.jobs where customer_id = target_customer_id;
  delete from public.customers where id = target_customer_id;

  return query select unnest(stored_paths);
end;
$$;

revoke all on function public.beta_permanently_delete_job(uuid) from public, anon, authenticated;
revoke all on function public.beta_permanently_delete_customer(uuid) from public, anon, authenticated;
grant execute on function public.beta_permanently_delete_job(uuid) to service_role;
grant execute on function public.beta_permanently_delete_customer(uuid) to service_role;

