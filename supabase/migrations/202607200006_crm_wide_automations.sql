begin;

alter table public.automation_rules
  add column if not exists trigger_event text,
  add column if not exists trigger_value text,
  add column if not exists action_type text,
  add column if not exists target_status text;

update public.automation_rules
set trigger_event = coalesce(trigger_event, 'job_status_changed'),
    trigger_value = coalesce(trigger_value, trigger_status),
    action_type = coalesce(action_type, 'create_task');

alter table public.automation_rules
  alter column trigger_event set default 'job_status_changed',
  alter column trigger_event set not null,
  alter column action_type set default 'create_task',
  alter column action_type set not null,
  alter column trigger_status drop not null,
  alter column task_title drop not null;

alter table public.automation_rules
  drop constraint if exists automation_rules_trigger_event_check,
  drop constraint if exists automation_rules_action_type_check,
  add constraint automation_rules_trigger_event_check check (trigger_event in (
    'job_created', 'job_status_changed', 'customer_created',
    'appointment_scheduled', 'appointment_completed', 'task_completed'
  )),
  add constraint automation_rules_action_type_check check (action_type in (
    'create_task', 'update_job_status'
  ));

create index if not exists automation_rules_event_value_active_idx
  on public.automation_rules(trigger_event, trigger_value, active, sort_order);

insert into public.automation_rules (
  name, trigger_event, trigger_value, action_type, target_status,
  trigger_status, task_title, due_offset_days, assignment_type, active, sort_order
)
select 'Move job to Floor Measure when measurement is scheduled',
       'appointment_scheduled', 'measure', 'update_job_status', 'Floor Measure',
       null, null, 0, 'job_salesperson', true, 0
where not exists (
  select 1 from public.automation_rules
  where trigger_event = 'appointment_scheduled'
    and trigger_value = 'measure'
    and action_type = 'update_job_status'
);

insert into public.automation_rules (
  name, trigger_event, trigger_value, action_type, target_status,
  trigger_status, task_title, due_offset_days, assignment_type, active, sort_order
)
select 'Move job to Install Scheduled when installation is scheduled',
       'appointment_scheduled', 'installation', 'update_job_status', 'Install Scheduled',
       null, null, 0, 'job_salesperson', true, 0
where not exists (
  select 1 from public.automation_rules
  where trigger_event = 'appointment_scheduled'
    and trigger_value = 'installation'
    and action_type = 'update_job_status'
);

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
  assigned_employee_id uuid;
  assigned_employee_name text;
  general_type_id uuid;
  created_task_id uuid;
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
      update public.jobs
      set status = matching_rule.target_status
      where id = related_job_id
        and status is distinct from matching_rule.target_status;

    elsif matching_rule.action_type = 'create_task' then
      if matching_rule.assignment_type = 'specific_employee' then
        assigned_employee_id := matching_rule.assigned_employee_id;
      else
        assigned_employee_id := related_employee_id;
        if assigned_employee_id is null and related_salesperson is not null then
          select id into assigned_employee_id
          from public.employees
          where name = related_salesperson and active = true
          limit 1;
        end if;
      end if;

      select name into assigned_employee_name
      from public.employees where id = assigned_employee_id;

      insert into public.job_tasks (
        job_id, customer_id, title, assigned_to, assigned_employee_id,
        due_date, due_at, completed, status, priority, task_type_id,
        automation_rule_id, automation_transition_id
      ) values (
        related_job_id, related_customer_id, matching_rule.task_title,
        assigned_employee_name, assigned_employee_id,
        current_date + matching_rule.due_offset_days,
        now() + make_interval(days => matching_rule.due_offset_days),
        false, 'open', 'normal', general_type_id,
        matching_rule.id, transition_id
      )
      on conflict (automation_transition_id, automation_rule_id)
        where automation_transition_id is not null and automation_rule_id is not null
        do nothing
      returning id into created_task_id;
    end if;

    if related_job_id is not null then
      insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
      values (
        related_job_id, 'crm_automation',
        'Automation "' || matching_rule.name || '" ran after ' || replace(event_name, '_', ' '),
        event_value,
        case when matching_rule.action_type = 'update_job_status'
          then matching_rule.target_status else matching_rule.task_title end
      );
    end if;

    assigned_employee_id := null;
    assigned_employee_name := null;
    created_task_id := null;
  end loop;
end;
$$;

create or replace function public.handle_job_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.run_crm_automations('job_created', null, new.id, new.customer_id, new.salesperson, null, new.id);
    perform public.run_crm_automations('job_status_changed', new.status, new.id, new.customer_id, new.salesperson, null, gen_random_uuid());
  elsif new.status is distinct from old.status then
    perform public.run_crm_automations('job_status_changed', new.status, new.id, new.customer_id, new.salesperson, null, gen_random_uuid());
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_create_automated_status_task on public.jobs;
drop trigger if exists jobs_create_automated_status_tasks on public.jobs;
drop trigger if exists jobs_run_crm_automations on public.jobs;
create trigger jobs_run_crm_automations
after insert or update of status on public.jobs
for each row execute function public.handle_job_automation_events();

create or replace function public.handle_appointment_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare customer uuid; salesperson text;
begin
  if new.job_id is null then return new; end if;
  select customer_id, jobs.salesperson into customer, salesperson from public.jobs where id = new.job_id;

  if new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.appointment_type is distinct from new.appointment_type) then
    perform public.run_crm_automations('appointment_scheduled', new.appointment_type, new.job_id, customer, salesperson, new.assigned_employee_id, new.id);
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.run_crm_automations('appointment_completed', new.appointment_type, new.job_id, customer, salesperson, new.assigned_employee_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_run_crm_automations on public.appointments;
create trigger appointments_run_crm_automations
after insert or update of status, appointment_type on public.appointments
for each row execute function public.handle_appointment_automation_events();

create or replace function public.handle_task_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare salesperson text;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if new.job_id is not null then select jobs.salesperson into salesperson from public.jobs where id = new.job_id; end if;
    perform public.run_crm_automations('task_completed', null, new.job_id, new.customer_id, salesperson, new.assigned_employee_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists job_tasks_run_crm_automations on public.job_tasks;
create trigger job_tasks_run_crm_automations
after insert or update of status on public.job_tasks
for each row execute function public.handle_task_automation_events();

create or replace function public.handle_customer_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.run_crm_automations('customer_created', null, null, new.id, null, null, new.id);
  return new;
end;
$$;

drop trigger if exists customers_run_crm_automations on public.customers;
create trigger customers_run_crm_automations
after insert on public.customers
for each row execute function public.handle_customer_automation_events();

commit;
