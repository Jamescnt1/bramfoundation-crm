begin;

alter table public.job_notes
  add column if not exists source text not null default 'manual';

alter table public.job_notes
  drop constraint if exists job_notes_source_check;
alter table public.job_notes
  add constraint job_notes_source_check check (source in ('manual', 'job_form'));

-- Reuse an existing identical durable note when possible so the backfill does
-- not create a duplicate for jobs whose legacy note was copied manually.
with matching_notes as (
  select distinct on (jobs.id) notes.id
  from public.jobs jobs
  join public.job_notes notes
    on notes.job_id = jobs.id
   and notes.deleted_at is null
   and notes.source = 'manual'
   and btrim(notes.body) = btrim(jobs.notes)
  where nullif(btrim(jobs.notes), '') is not null
  order by jobs.id, notes.created_at
)
update public.job_notes notes
set source = 'job_form'
from matching_notes
where notes.id = matching_notes.id;

create unique index if not exists job_notes_job_form_source_idx
  on public.job_notes(job_id)
  where source = 'job_form';

insert into public.job_notes (job_id, author_employee_id, body, source, created_at, updated_at)
select jobs.id, jobs.assigned_employee_id, btrim(jobs.notes), 'job_form', jobs.created_at, coalesce(jobs.updated_at, jobs.created_at)
from public.jobs jobs
where nullif(btrim(jobs.notes), '') is not null
  and not exists (
    select 1 from public.job_notes notes
    where notes.job_id = jobs.id and notes.source = 'job_form'
  );

create or replace function public.sync_job_form_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_id uuid;
begin
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes then return new; end if;

  select employees.id into actor_id
  from public.employees employees
  where employees.auth_user_id = auth.uid() and employees.active = true
  limit 1;

  if nullif(btrim(new.notes), '') is null then
    update public.job_notes
    set deleted_at = now(), deleted_by_employee_id = actor_id, updated_at = now()
    where job_id = new.id and source = 'job_form' and deleted_at is null;
  else
    insert into public.job_notes (job_id, author_employee_id, body, source)
    values (new.id, actor_id, btrim(new.notes), 'job_form')
    on conflict (job_id) where source = 'job_form'
    do update set
      body = excluded.body,
      updated_at = now(),
      deleted_at = null,
      deleted_by_employee_id = null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_sync_job_form_note on public.jobs;
create trigger jobs_sync_job_form_note
after insert or update of notes on public.jobs
for each row execute function public.sync_job_form_note();

commit;
