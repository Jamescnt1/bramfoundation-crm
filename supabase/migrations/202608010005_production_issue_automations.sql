begin;

alter table public.automation_rules
  add column if not exists task_priority text not null default 'normal';

alter table public.automation_rules
  drop constraint if exists automation_rules_task_priority_check;
alter table public.automation_rules
  add constraint automation_rules_task_priority_check
    check (task_priority in ('low', 'normal', 'high', 'urgent'));

alter table public.automation_rules
  drop constraint if exists automation_rules_trigger_event_check;
alter table public.automation_rules
  add constraint automation_rules_trigger_event_check check (trigger_event in (
    'job_created', 'job_status_changed', 'customer_created',
    'appointment_scheduled', 'appointment_completed', 'task_completed',
    'lead_untouched_daily', 'production_scope_created', 'material_issue',
    'material_ordered', 'material_ready', 'material_excluded',
    'all_materials_ordered', 'all_materials_ready', 'work_order_sent',
    'all_work_orders_sent'
  ));

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
          due_date, due_at, completed, status, priority, task_type_id,
          automation_rule_id, automation_transition_id
        ) values (
          related_job_id, related_customer_id, rendered_task_title,
          assigned_employee_name, recipient_id,
          current_date + matching_rule.due_offset_days,
          now() + make_interval(days => matching_rule.due_offset_days),
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

create or replace function public.handle_material_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  customer uuid; salesperson text; assigned_employee uuid;
  all_ordered boolean; all_ready boolean;
begin
  select customer_id, jobs.salesperson, assigned_employee_id
  into customer, salesperson, assigned_employee
  from public.jobs where id = new.job_id;

  if tg_op = 'INSERT' then
    perform public.run_crm_automations('production_scope_created', null, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;
  if new.material_status = 'issue'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_issue', new.issue_note, new.job_id, customer, salesperson, assigned_employee, gen_random_uuid());
  end if;
  if new.material_status = 'ordered'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_ordered', null, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;
  if new.material_status = 'ready'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_ready', null, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;
  if new.material_status = 'excluded'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_excluded', new.excluded_reason, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;

  select
    bool_and(not ordering_required or material_status in ('ordered','partially_received','ready','excluded')),
    bool_and(material_status in ('ready','excluded'))
  into all_ordered, all_ready from public.job_material_scopes where job_id = new.job_id;
  if all_ordered then
    perform public.run_crm_automations('all_materials_ordered', null, new.job_id, customer, salesperson, assigned_employee, new.job_id);
  end if;
  if all_ready then
    perform public.run_crm_automations('all_materials_ready', null, new.job_id, customer, salesperson, assigned_employee, new.job_id);
  end if;
  return new;
end;
$$;

insert into public.automation_rules (
  name, trigger_event, trigger_value, action_type, trigger_status,
  task_title, task_priority, due_offset_days, assignment_type, active, sort_order
)
select 'Escalate production issue', 'material_issue', null, 'create_task', null,
       'URGENT: Production issue — {{issue}}', 'urgent', 0,
       'job_salesperson', true, 0
where not exists (
  select 1 from public.automation_rules
  where trigger_event = 'material_issue' and action_type = 'create_task'
);

commit;
