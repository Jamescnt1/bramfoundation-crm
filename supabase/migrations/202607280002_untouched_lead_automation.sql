begin;

alter table public.automation_rules
  drop constraint if exists automation_rules_trigger_event_check;

alter table public.automation_rules
  add constraint automation_rules_trigger_event_check check (
    trigger_event in (
      'job_created',
      'job_status_changed',
      'customer_created',
      'appointment_scheduled',
      'appointment_completed',
      'task_completed',
      'lead_untouched_daily'
    )
  );

insert into public.automation_rules (
  name,
  trigger_event,
  trigger_value,
  action_type,
  task_title,
  due_offset_days,
  assignment_type,
  active,
  sort_order
)
select
  'Daily untouched lead reminder',
  'lead_untouched_daily',
  null,
  'create_task',
  'Follow up on untouched lead',
  0,
  'job_salesperson',
  false,
  0
where not exists (
  select 1
  from public.automation_rules
  where trigger_event = 'lead_untouched_daily'
);

create or replace function public.run_untouched_lead_automations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_job record;
begin
  for stale_job in
    select
      jobs.id,
      jobs.customer_id,
      jobs.salesperson,
      jobs.assigned_employee_id
    from public.jobs jobs
    join public.pipeline_stages stages
      on lower(stages.slug) = lower(jobs.status)
      or lower(stages.label) = lower(jobs.status)
    where jobs.archived_at is null
      and stages.active = true
      and stages.lead_queue = true
      and greatest(
        coalesce(jobs.updated_at, jobs.created_at),
        coalesce(
          (
            select max(activities.created_at)
            from public.job_activities activities
            where activities.job_id = jobs.id
              and activities.activity_type <> 'crm_automation'
          ),
          jobs.created_at
        )
      ) < now() - interval '24 hours'
  loop
    perform public.run_crm_automations(
      'lead_untouched_daily',
      null,
      stale_job.id,
      stale_job.customer_id,
      stale_job.salesperson,
      stale_job.assigned_employee_id,
      md5(stale_job.id::text || current_date::text)::uuid
    );
  end loop;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'foundation-untouched-lead-reminders'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'foundation-untouched-lead-reminders',
  '0 15 * * *',
  'select public.run_untouched_lead_automations();'
);

commit;
