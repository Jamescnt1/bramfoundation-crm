begin;

alter table public.automation_rules
  drop constraint if exists automation_rules_specific_employee_check;

create table if not exists public.automation_rule_recipients (
  id uuid primary key default gen_random_uuid(),
  automation_rule_id uuid not null
    references public.automation_rules(id) on delete cascade,
  recipient_type text not null
    check (recipient_type in ('employee', 'role')),
  employee_id uuid references public.employees(id) on delete cascade,
  role_key text references public.role_definitions(key) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  constraint automation_rule_recipient_target_check check (
    (recipient_type = 'employee' and employee_id is not null and role_key is null)
    or
    (recipient_type = 'role' and role_key is not null and employee_id is null)
  )
);

create unique index if not exists automation_rule_recipient_employee_idx
  on public.automation_rule_recipients(automation_rule_id, employee_id)
  where recipient_type = 'employee';

create unique index if not exists automation_rule_recipient_role_idx
  on public.automation_rule_recipients(automation_rule_id, role_key)
  where recipient_type = 'role';

insert into public.automation_rule_recipients (
  automation_rule_id,
  recipient_type,
  employee_id
)
select id, 'employee', assigned_employee_id
from public.automation_rules
where assignment_type = 'specific_employee'
  and assigned_employee_id is not null
on conflict do nothing;

alter table public.automation_rule_recipients enable row level security;

drop policy if exists "Authenticated users can view automation recipients"
  on public.automation_rule_recipients;
create policy "Authenticated users can view automation recipients"
on public.automation_rule_recipients for select to authenticated
using (public.current_employee_is_active());

drop index if exists public.job_tasks_automation_rule_transition_idx;
create unique index if not exists job_tasks_automation_rule_transition_recipient_idx
  on public.job_tasks(
    automation_transition_id,
    automation_rule_id,
    coalesce(assigned_employee_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where automation_transition_id is not null
    and automation_rule_id is not null;

create or replace function public.run_crm_automations(
  event_name text,
  event_value text,
  related_job_id uuid,
  related_customer_id uuid,
  related_salesperson text,
  related_employee_id uuid,
  event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_rule public.automation_rules%rowtype;
  transition_id uuid := coalesce(event_id, gen_random_uuid());
  recipient_id uuid;
  assigned_employee_name text;
  general_type_id uuid;
begin
  select id into general_type_id from public.task_types
  where name = 'General' limit 1;

  for matching_rule in
    select * from public.automation_rules
    where trigger_event = event_name
      and (trigger_value is null or trigger_value = event_value)
      and active = true
    order by sort_order, created_at, id
  loop
    if matching_rule.action_type = 'update_job_status'
       and related_job_id is not null then
      update public.jobs
      set status = matching_rule.target_status
      where id = related_job_id
        and status is distinct from matching_rule.target_status;

    elsif matching_rule.action_type = 'create_task' then
      for recipient_id in
        select distinct resolved.employee_id
        from (
          select recipients.employee_id
          from public.automation_rule_recipients recipients
          join public.employees employees on employees.id = recipients.employee_id
          where recipients.automation_rule_id = matching_rule.id
            and recipients.recipient_type = 'employee'
            and employees.active = true

          union

          select employees.id
          from public.automation_rule_recipients recipients
          join public.employees employees on employees.role = recipients.role_key
          where recipients.automation_rule_id = matching_rule.id
            and recipients.recipient_type = 'role'
            and employees.active = true

          union

          select coalesce(
            case when matching_rule.assignment_type = 'specific_employee'
              then matching_rule.assigned_employee_id end,
            related_employee_id,
            (
              select employees.id from public.employees employees
              where employees.name = related_salesperson and employees.active = true
              limit 1
            )
          )
          where not exists (
            select 1 from public.automation_rule_recipients recipients
            where recipients.automation_rule_id = matching_rule.id
          )
        ) resolved
        where resolved.employee_id is not null
      loop
        select name into assigned_employee_name
        from public.employees where id = recipient_id;

        insert into public.job_tasks (
          job_id, customer_id, title, assigned_to, assigned_employee_id,
          due_date, due_at, completed, status, priority, task_type_id,
          automation_rule_id, automation_transition_id
        ) values (
          related_job_id, related_customer_id, matching_rule.task_title,
          assigned_employee_name, recipient_id,
          current_date + matching_rule.due_offset_days,
          now() + make_interval(days => matching_rule.due_offset_days),
          false, 'open', 'normal', general_type_id,
          matching_rule.id, transition_id
        )
        on conflict do nothing;
      end loop;
    end if;

    if related_job_id is not null then
      insert into public.job_activities (
        job_id, activity_type, description, old_value, new_value
      ) values (
        related_job_id, 'crm_automation',
        'Automation "' || matching_rule.name || '" ran after ' || replace(event_name, '_', ' '),
        event_value,
        case when matching_rule.action_type = 'update_job_status'
          then matching_rule.target_status else matching_rule.task_title end
      );
    end if;
  end loop;
end;
$$;

commit;
