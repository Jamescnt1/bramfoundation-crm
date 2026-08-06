begin;

create or replace function public.pipeline_stage_is_billed(stage_status text)
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
      lower(stages.slug) in ('billed', 'billed_jobs')
      or lower(btrim(stages.label)) in ('billed', 'billed jobs')
    )
  );
$$;

create or replace function public.sync_billed_status_timestamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.pipeline_stage_is_billed(new.status) and new.billed_at is null then
    new.billed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_sync_billed_status_timestamp on public.jobs;
create trigger jobs_sync_billed_status_timestamp
before insert or update of status on public.jobs
for each row execute function public.sync_billed_status_timestamp();

-- Backfill existing billed-stage jobs from their recorded pipeline transition.
-- Fall back to the terminal-stage timestamp only when no activity row exists.
update public.jobs jobs
set billed_at = coalesce(
  (
    select max(activity.created_at)
    from public.job_activities activity
    where activity.job_id = jobs.id
      and activity.activity_type = 'status_changed'
      and public.pipeline_stage_is_billed(activity.new_value)
  ),
  jobs.pipeline_terminal_entered_at,
  jobs.updated_at,
  jobs.created_at
)
where public.pipeline_stage_is_billed(jobs.status)
  and jobs.billed_at is null
  and jobs.contract_amount is not null
  and jobs.contract_amount > 0;

commit;
