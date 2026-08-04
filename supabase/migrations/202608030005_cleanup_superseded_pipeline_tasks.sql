begin;

-- Pipeline-generated tasks are normally no longer actionable after the job
-- advances beyond the stage that created them. Preserve the task record as
-- cancelled so history and reporting remain intact.
update public.automation_rules
set cancel_on_pipeline_advance = true,
    updated_at = now()
where action_type = 'create_task'
  and trigger_event = 'job_status_changed';

-- Make stage comparisons alias-aware so legacy labels and current slugs behave
-- the same way when a job advances.
create or replace function public.cancel_superseded_automation_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_stage_order integer;
  cancelled_count integer;
begin
  if new.status is not distinct from old.status then return new; end if;

  select stages.sort_order into new_stage_order
  from public.pipeline_stages stages
  where lower(stages.slug) = lower(new.status)
     or lower(stages.label) = lower(new.status)
     or stages.slug = (
       select aliases.stage_slug from public.pipeline_stage_aliases aliases
       where lower(aliases.alias) = lower(new.status) limit 1
     )
  order by stages.active desc, stages.sort_order
  limit 1;

  if new_stage_order is null then return new; end if;

  update public.job_tasks tasks
  set status = 'cancelled'
  from public.automation_rules rules
  where tasks.job_id = new.id
    and tasks.automation_rule_id = rules.id
    and tasks.status in ('open', 'in_progress', 'waiting')
    and rules.action_type = 'create_task'
    and rules.trigger_event = 'job_status_changed'
    and rules.cancel_on_pipeline_advance = true
    and exists (
      select 1 from public.pipeline_stages origin_stage
      where (
        lower(origin_stage.slug) = lower(rules.trigger_value)
        or lower(origin_stage.label) = lower(rules.trigger_value)
        or origin_stage.slug = (
          select aliases.stage_slug from public.pipeline_stage_aliases aliases
          where lower(aliases.alias) = lower(rules.trigger_value) limit 1
        )
      )
      and origin_stage.sort_order < new_stage_order
    );

  get diagnostics cancelled_count = row_count;
  if cancelled_count > 0 then
    insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
    values (
      new.id, 'crm_automation',
      cancelled_count || ' superseded automation task'
        || case when cancelled_count = 1 then ' was' else 's were' end
        || ' cancelled after the pipeline advanced.',
      old.status, new.status
    );
  end if;
  return new;
end;
$$;

-- One-time cleanup for unfinished automated tasks whose jobs are already past
-- the pipeline stage that originally created those tasks.
with superseded as (
  select tasks.id, tasks.job_id
  from public.job_tasks tasks
  join public.jobs jobs on jobs.id = tasks.job_id
  join public.automation_rules rules on rules.id = tasks.automation_rule_id
  cross join lateral (
    select stages.sort_order
    from public.pipeline_stages stages
    where lower(stages.slug) = lower(jobs.status)
       or lower(stages.label) = lower(jobs.status)
       or stages.slug = (
         select aliases.stage_slug from public.pipeline_stage_aliases aliases
         where lower(aliases.alias) = lower(jobs.status) limit 1
       )
    order by stages.active desc, stages.sort_order
    limit 1
  ) current_stage
  cross join lateral (
    select stages.sort_order
    from public.pipeline_stages stages
    where lower(stages.slug) = lower(rules.trigger_value)
       or lower(stages.label) = lower(rules.trigger_value)
       or stages.slug = (
         select aliases.stage_slug from public.pipeline_stage_aliases aliases
         where lower(aliases.alias) = lower(rules.trigger_value) limit 1
       )
    order by stages.active desc, stages.sort_order
    limit 1
  ) origin_stage
  where tasks.status in ('open', 'in_progress', 'waiting')
    and jobs.archived_at is null
    and rules.action_type = 'create_task'
    and rules.trigger_event = 'job_status_changed'
    and rules.cancel_on_pipeline_advance = true
    and origin_stage.sort_order < current_stage.sort_order
), cancelled as (
  update public.job_tasks tasks
  set status = 'cancelled'
  from superseded
  where tasks.id = superseded.id
  returning tasks.job_id
)
insert into public.job_activities (job_id, activity_type, description)
select job_id, 'crm_automation',
       count(*) || ' existing superseded automation task'
         || case when count(*) = 1 then ' was' else 's were' end
         || ' cancelled during pipeline task cleanup.'
from cancelled
group by job_id;

commit;
