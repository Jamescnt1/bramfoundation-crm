begin;

-- This is pipeline-only retention. jobs.archived_at remains untouched so closed
-- jobs continue to participate in search, reports, customer history, and their
-- complete job workspaces.
alter table public.jobs
  add column if not exists pipeline_terminal_entered_at timestamptz,
  add column if not exists pipeline_hide_after timestamptz;

create index if not exists jobs_pipeline_retention_idx
  on public.jobs(pipeline_hide_after, status)
  where archived_at is null and pipeline_hide_after is not null;

create or replace function public.pipeline_stage_is_closed(stage_status text)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.pipeline_stages stages
    where (
      lower(stages.slug) = lower(stage_status)
      or lower(stages.label) = lower(stage_status)
      or stages.slug = (
        select aliases.stage_slug from public.pipeline_stage_aliases aliases
        where lower(aliases.alias) = lower(stage_status) limit 1
      )
    )
    and (
      lower(stages.slug) in ('lost', 'billed')
      or lower(btrim(stages.label)) in ('lost', 'billed')
    )
  );
$$;

create or replace function public.prepare_pipeline_retention()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.pipeline_stage_is_closed(new.status) then
      new.pipeline_terminal_entered_at := now();
      new.pipeline_hide_after := now() + interval '30 days';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and public.pipeline_stage_is_closed(new.status) then
    new.pipeline_terminal_entered_at := now();
    new.pipeline_hide_after := now() + interval '30 days';
  elsif new.status is distinct from old.status then
    new.pipeline_terminal_entered_at := null;
    new.pipeline_hide_after := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_prepare_pipeline_retention on public.jobs;
create trigger jobs_prepare_pipeline_retention
before insert or update of status on public.jobs
for each row
execute function public.prepare_pipeline_retention();

-- Existing closed jobs use their last update as the best available estimate of
-- when they entered the terminal stage. Future transitions are exact.
update public.jobs
set pipeline_terminal_entered_at = coalesce(updated_at, created_at),
    pipeline_hide_after = coalesce(updated_at, created_at) + interval '30 days'
where archived_at is null
  and public.pipeline_stage_is_closed(status)
  and pipeline_hide_after is null;

alter table public.employees
  add column if not exists pipeline_history_view text not null default 'active';

alter table public.employees
  drop constraint if exists employees_pipeline_history_view_check;
alter table public.employees
  add constraint employees_pipeline_history_view_check
  check (pipeline_history_view in ('active', 'closed', 'all'));

commit;
