begin;

alter table public.automation_rules
  add column if not exists delivery_offset_days integer not null default 0;

alter table public.automation_rules
  drop constraint if exists automation_rules_delivery_offset_days_check;
alter table public.automation_rules
  add constraint automation_rules_delivery_offset_days_check
  check (delivery_offset_days >= 0 and delivery_offset_days <= 365);

alter table public.job_tasks
  add column if not exists available_at timestamptz not null default now();

comment on column public.automation_rules.delivery_offset_days is
  'Days after the triggering action before a generated task becomes visible to its recipient.';
comment on column public.job_tasks.available_at is
  'Task delivery time. Operational task lists and warnings exclude tasks until this time.';

create index if not exists job_tasks_available_assignment_idx
  on public.job_tasks(available_at, assigned_employee_id, status);

create or replace function public.run_crm_automations(
  event_name text, event_value text, related_job_id uuid,
  related_customer_id uuid, related_salesperson text,
  related_employee_id uuid, event_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare
  matching_rule public.automation_rules%rowtype;
  transition_id uuid := coalesce(event_id, gen_random_uuid());
  recipient_id uuid;
  assigned_employee_name text;
  general_type_id uuid;
  rendered_task_title text;
  delivery_time timestamptz;
begin
  select id into general_type_id from public.task_types where name = 'General' limit 1;

  for matching_rule in
    select * from public.automation_rules
    where trigger_event = event_name
      and (trigger_value is null or trigger_value = event_value)
      and active = true
    order by sort_order, created_at, id
  loop
    if matching_rule.action_type = 'update_job_status' and related_job_id is not null then
      update public.jobs set status = matching_rule.target_status
      where id = related_job_id and status is distinct from matching_rule.target_status;
    elsif matching_rule.action_type = 'create_task' then
      delivery_time := now() + make_interval(days => matching_rule.delivery_offset_days);
      rendered_task_title := replace(
        replace(matching_rule.task_title, '{{issue}}', coalesce(event_value, 'Production issue')),
        '{{event_detail}}', coalesce(event_value, '')
      );
      for recipient_id in
        select distinct resolved.employee_id from (
          select recipients.employee_id
          from public.automation_rule_recipients recipients
          join public.employees employees on employees.id = recipients.employee_id
          where recipients.automation_rule_id = matching_rule.id
            and recipients.recipient_type = 'employee' and employees.active = true
          union
          select employees.id
          from public.automation_rule_recipients recipients
          join public.employees employees on employees.role = recipients.role_key
          where recipients.automation_rule_id = matching_rule.id
            and recipients.recipient_type = 'role' and employees.active = true
          union
          select coalesce(
            case when matching_rule.assignment_type = 'specific_employee'
              then matching_rule.assigned_employee_id end,
            related_employee_id,
            (select employees.id from public.employees employees
             where employees.name = related_salesperson and employees.active = true limit 1)
          )
          where not exists (
            select 1 from public.automation_rule_recipients recipients
            where recipients.automation_rule_id = matching_rule.id
          )
        ) resolved where resolved.employee_id is not null
      loop
        select name into assigned_employee_name from public.employees where id = recipient_id;
        insert into public.job_tasks (
          job_id, customer_id, title, assigned_to, assigned_employee_id,
          available_at, due_date, due_at, completed, status, priority, task_type_id,
          automation_rule_id, automation_transition_id
        ) values (
          related_job_id, related_customer_id, rendered_task_title,
          assigned_employee_name, recipient_id, delivery_time,
          (delivery_time at time zone coalesce(
            (select timezone from public.company_settings where singleton_key = true limit 1),
            'America/Phoenix'
          ))::date + matching_rule.due_offset_days,
          delivery_time + make_interval(days => matching_rule.due_offset_days),
          false, 'open', matching_rule.task_priority, general_type_id,
          matching_rule.id, transition_id
        ) on conflict do nothing;
      end loop;
    end if;

    if related_job_id is not null then
      insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
      values (
        related_job_id, 'crm_automation',
        'Automation "' || matching_rule.name || '" ran after ' || replace(event_name, '_', ' '),
        event_value,
        case when matching_rule.action_type = 'update_job_status'
          then matching_rule.target_status else rendered_task_title end
      );
    end if;
  end loop;
end;
$$;

commit;
