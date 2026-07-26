begin;

alter table public.jobs
  add column if not exists installation_required boolean not null default true;

create index if not exists jobs_installation_required_idx
  on public.jobs (installation_required)
  where archived_at is null;

create or replace function public.job_has_install_appointment(target_job_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments
    where job_id = target_job_id
      and appointment_type = 'installation'
      and status <> 'cancelled'
  );
$$;

create or replace function public.enforce_install_scheduled_requirement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.installation_required is distinct from new.installation_required
     )
     and new.installation_required
     and (
       new.status = 'install_scheduled'
       or lower(new.status) in ('install scheduled', 'installation scheduled')
     )
     and not public.job_has_install_appointment(new.id) then
    raise exception 'INSTALL_APPOINTMENT_REQUIRED: Schedule an installation before moving this job to Install Scheduled.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enforce_install_scheduled_requirement on public.jobs;
create trigger jobs_enforce_install_scheduled_requirement
before insert or update of status, installation_required on public.jobs
for each row execute function public.enforce_install_scheduled_requirement();

commit;
