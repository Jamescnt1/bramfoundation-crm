begin;

alter table public.jobs
  add column if not exists on_hold boolean not null default false,
  add column if not exists hold_reason text,
  add column if not exists hold_until date,
  add column if not exists hold_note text,
  add column if not exists held_by uuid references public.employees(id) on delete set null,
  add column if not exists held_at timestamptz;

alter table public.jobs
  drop constraint if exists jobs_hold_details_check;
alter table public.jobs
  add constraint jobs_hold_details_check check (
    (not on_hold) or (hold_reason is not null and btrim(hold_reason) <> '' and hold_until is not null)
  );

create index if not exists jobs_on_hold_follow_up_idx
  on public.jobs(on_hold, hold_until)
  where archived_at is null;

alter table public.employees
  add column if not exists pipeline_hold_view text not null default 'active';

alter table public.employees
  drop constraint if exists employees_pipeline_hold_view_check;
alter table public.employees
  add constraint employees_pipeline_hold_view_check
  check (pipeline_hold_view in ('active', 'on_hold', 'all'));

create or replace function public.release_job_hold_on_pipeline_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and old.on_hold then
    new.on_hold := false;
    new.hold_reason := null;
    new.hold_until := null;
    new.hold_note := null;
    new.held_by := null;
    new.held_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_release_hold_on_pipeline_change on public.jobs;
create trigger jobs_release_hold_on_pipeline_change
before update of status on public.jobs
for each row execute function public.release_job_hold_on_pipeline_change();

commit;
