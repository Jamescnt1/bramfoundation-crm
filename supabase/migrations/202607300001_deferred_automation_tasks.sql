begin;

alter table public.automation_rules
  add column if not exists cancel_on_pipeline_advance boolean not null default false;

comment on column public.automation_rules.cancel_on_pipeline_advance is
  'Cancels unfinished tasks created by this rule when the related job advances beyond the rule trigger stage.';

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
  if new.status is not distinct from old.status then
    return new;
  end if;

  select stages.sort_order
  into new_stage_order
  from public.pipeline_stages stages
  where lower(stages.slug) = lower(new.status)
     or lower(stages.label) = lower(new.status)
  order by stages.sort_order
  limit 1;

  if new_stage_order is null then
    return new;
  end if;

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
      select 1
      from public.pipeline_stages origin_stage
      where (
          lower(origin_stage.slug) = lower(rules.trigger_value)
          or lower(origin_stage.label) = lower(rules.trigger_value)
        )
        and origin_stage.sort_order < new_stage_order
    );

  get diagnostics cancelled_count = row_count;

  if cancelled_count > 0 then
    insert into public.job_activities (
      job_id,
      activity_type,
      description,
      old_value,
      new_value
    )
    values (
      new.id,
      'crm_automation',
      cancelled_count || ' superseded automation task'
        || case when cancelled_count = 1 then ' was' else 's were' end
        || ' cancelled after the pipeline advanced.',
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_cancel_superseded_automation_tasks
  on public.jobs;

create trigger jobs_cancel_superseded_automation_tasks
after update of status on public.jobs
for each row
when (old.status is distinct from new.status)
execute function public.cancel_superseded_automation_tasks();

create index if not exists job_tasks_pending_automation_idx
  on public.job_tasks(job_id, automation_rule_id, due_at)
  where status in ('open', 'in_progress', 'waiting')
    and automation_rule_id is not null;

commit;
