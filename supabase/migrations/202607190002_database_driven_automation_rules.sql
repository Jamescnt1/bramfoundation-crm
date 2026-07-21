begin;

do $$
begin
  if to_regclass('public.automation_rules') is null
     and to_regclass('public.task_automation_rules') is not null then
    alter table public.task_automation_rules rename to automation_rules;
  end if;
end
$$;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_status text not null,
  task_title text not null,
  due_offset_days integer not null default 0,
  assignment_type text not null default 'job_salesperson',
  assigned_employee_id uuid references public.employees(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'automation_rules'
      and column_name = 'status'
  ) then
    alter table public.automation_rules rename column status to trigger_status;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'automation_rules'
      and column_name = 'due_days'
  ) then
    alter table public.automation_rules rename column due_days to due_offset_days;
  end if;
end
$$;

alter table public.automation_rules
  add column if not exists name text,
  add column if not exists trigger_status text,
  add column if not exists task_title text,
  add column if not exists due_offset_days integer,
  add column if not exists assignment_type text,
  add column if not exists assigned_employee_id uuid
    references public.employees(id) on delete set null,
  add column if not exists active boolean,
  add column if not exists sort_order integer,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.automation_rules
set
  name = coalesce(nullif(name, ''), task_title),
  due_offset_days = coalesce(due_offset_days, 0),
  assignment_type = coalesce(assignment_type, 'job_salesperson'),
  active = coalesce(active, true),
  sort_order = coalesce(sort_order, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.automation_rules
  alter column name set not null,
  alter column trigger_status set not null,
  alter column task_title set not null,
  alter column due_offset_days set default 0,
  alter column due_offset_days set not null,
  alter column assignment_type set default 'job_salesperson',
  alter column assignment_type set not null,
  alter column active set default true,
  alter column active set not null,
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.automation_rules
  drop constraint if exists task_automation_rules_status_key,
  drop constraint if exists automation_rules_trigger_status_key,
  drop constraint if exists task_automation_rules_due_days_check,
  drop constraint if exists automation_rules_due_offset_days_check,
  drop constraint if exists automation_rules_assignment_type_check,
  drop constraint if exists automation_rules_specific_employee_check;

alter table public.automation_rules
  add constraint automation_rules_due_offset_days_check
    check (due_offset_days >= 0),
  add constraint automation_rules_assignment_type_check
    check (assignment_type in ('job_salesperson', 'specific_employee')),
  add constraint automation_rules_specific_employee_check
    check (
      assignment_type <> 'specific_employee'
      or assigned_employee_id is not null
    );

create index if not exists automation_rules_trigger_active_order_idx
  on public.automation_rules(trigger_status, active, sort_order);

create index if not exists automation_rules_employee_idx
  on public.automation_rules(assigned_employee_id)
  where assigned_employee_id is not null;

with ordered_rules as (
  select
    id,
    row_number() over (
      partition by trigger_status
      order by sort_order, created_at, id
    ) - 1 as next_sort_order
  from public.automation_rules
)
update public.automation_rules as rules
set sort_order = ordered_rules.next_sort_order
from ordered_rules
where rules.id = ordered_rules.id;

insert into public.automation_rules (
  name,
  trigger_status,
  task_title,
  due_offset_days,
  assignment_type,
  active,
  sort_order
)
select *
from (values
  ('Call new lead', 'New Lead', 'Call customer', 1, 'job_salesperson', true, 0),
  ('Estimate follow-up', 'Estimate Sent', 'Follow up on estimate', 3, 'job_salesperson', true, 0),
  ('Order approved materials', 'Approved', 'Order materials', 0, 'job_salesperson', true, 0),
  ('Confirm material arrival', 'Materials Ordered', 'Confirm material arrival', 0, 'job_salesperson', true, 0),
  ('Confirm installation', 'Install Scheduled', 'Confirm installation with customer', 0, 'job_salesperson', true, 0),
  ('Request customer review', 'Complete', 'Request customer review', 1, 'job_salesperson', true, 0)
) as defaults(name, trigger_status, task_title, due_offset_days, assignment_type, active, sort_order)
where not exists (
  select 1
  from public.automation_rules existing
  where existing.trigger_status = defaults.trigger_status
    and existing.task_title = defaults.task_title
);

alter table public.job_tasks
  add column if not exists automation_rule_id uuid
    references public.automation_rules(id) on delete set null,
  add column if not exists automation_transition_id uuid;

drop index if exists public.job_tasks_automation_transition_idx;

create unique index if not exists job_tasks_automation_rule_transition_idx
  on public.job_tasks(automation_transition_id, automation_rule_id)
  where automation_transition_id is not null
    and automation_rule_id is not null;

create or replace function public.set_automation_rule_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists task_automation_rules_set_updated_at
  on public.automation_rules;
drop trigger if exists automation_rules_set_updated_at
  on public.automation_rules;

create trigger automation_rules_set_updated_at
before update on public.automation_rules
for each row
execute function public.set_automation_rule_updated_at();

create or replace function public.create_automated_tasks_for_job_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_rule public.automation_rules%rowtype;
  transition_id uuid := gen_random_uuid();
  assigned_employee_name text;
  created_task_id uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  for matching_rule in
    select *
    from public.automation_rules
    where trigger_status = new.status
      and active = true
    order by sort_order, created_at, id
  loop
    if matching_rule.assignment_type = 'specific_employee' then
      select name
      into assigned_employee_name
      from public.employees
      where id = matching_rule.assigned_employee_id
        and active = true;
    else
      assigned_employee_name := new.salesperson;
    end if;

    insert into public.job_tasks (
      job_id,
      title,
      assigned_to,
      due_date,
      completed,
      automation_rule_id,
      automation_transition_id
    )
    values (
      new.id,
      matching_rule.task_title,
      assigned_employee_name,
      current_date + matching_rule.due_offset_days,
      false,
      matching_rule.id,
      transition_id
    )
    on conflict (automation_transition_id, automation_rule_id)
      where automation_transition_id is not null
        and automation_rule_id is not null
      do nothing
    returning id into created_task_id;

    if created_task_id is not null then
      insert into public.job_activities (
        job_id,
        activity_type,
        description,
        old_value,
        new_value
      )
      values (
        new.id,
        'task_automated',
        'Automation "' || matching_rule.name || '" created task: ' || matching_rule.task_title,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status
      );
    end if;

    assigned_employee_name := null;
    created_task_id := null;
  end loop;

  return new;
end;
$$;

drop trigger if exists jobs_create_automated_status_task on public.jobs;
drop trigger if exists jobs_create_automated_status_tasks on public.jobs;

create trigger jobs_create_automated_status_tasks
after insert or update of status on public.jobs
for each row
execute function public.create_automated_tasks_for_job_status();

alter table public.automation_rules enable row level security;

drop policy if exists "Allow public automation rule reads" on public.automation_rules;
drop policy if exists "Allow public automation rule inserts" on public.automation_rules;
drop policy if exists "Allow public automation rule updates" on public.automation_rules;
drop policy if exists "Allow public automation rule deletes" on public.automation_rules;

create policy "Allow public automation rule reads"
on public.automation_rules for select
to anon, authenticated
using (true);

create policy "Allow public automation rule inserts"
on public.automation_rules for insert
to anon, authenticated
with check (true);

create policy "Allow public automation rule updates"
on public.automation_rules for update
to anon, authenticated
using (true)
with check (true);

create policy "Allow public automation rule deletes"
on public.automation_rules for delete
to anon, authenticated
using (true);

commit;
