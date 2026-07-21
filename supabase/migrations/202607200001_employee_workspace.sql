begin;

alter table public.employees
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text not null default 'office_staff',
  add column if not exists avatar_url text,
  add column if not exists color text not null default '#111827',
  add column if not exists job_title text,
  add column if not exists bio text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.employees
  drop constraint if exists employees_role_check;

alter table public.employees
  add constraint employees_role_check check (
    role in (
      'administrator',
      'sales_manager',
      'salesperson',
      'operations_manager',
      'installer',
      'office_staff'
    )
  );

create unique index if not exists employees_email_lower_idx
  on public.employees(lower(email)) where email is not null;

alter table public.jobs
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null;

alter table public.job_tasks
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null;

alter table public.appointments
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null;

create index if not exists jobs_assigned_employee_idx on public.jobs(assigned_employee_id);
create index if not exists job_tasks_assigned_employee_idx on public.job_tasks(assigned_employee_id);
create index if not exists appointments_assigned_employee_idx on public.appointments(assigned_employee_id);

update public.jobs jobs
set assigned_employee_id = employees.id
from public.employees employees
where jobs.assigned_employee_id is null
  and jobs.salesperson is not null
  and lower(trim(jobs.salesperson)) = lower(trim(employees.name));

update public.job_tasks tasks
set assigned_employee_id = employees.id
from public.employees employees
where tasks.assigned_employee_id is null
  and tasks.assigned_to is not null
  and lower(trim(tasks.assigned_to)) = lower(trim(employees.name));

create or replace function public.set_employee_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_employee_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'Employee'), '@', 1)
  );

  update public.employees
  set auth_user_id = new.id,
      email = coalesce(email, new.email),
      active = true
  where auth_user_id is null
    and new.email is not null
    and lower(email) = lower(new.email);

  if not found then
    insert into public.employees (auth_user_id, name, email, role, active)
    values (new.id, display_name, new.email, 'office_staff', true);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

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
  assigned_employee_uuid uuid;
  created_task_id uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  for matching_rule in
    select * from public.automation_rules
    where trigger_status = new.status and active = true
    order by sort_order, created_at, id
  loop
    if matching_rule.assignment_type = 'specific_employee' then
      select id, name into assigned_employee_uuid, assigned_employee_name
      from public.employees
      where id = matching_rule.assigned_employee_id and active = true;
    else
      assigned_employee_name := new.salesperson;
      assigned_employee_uuid := new.assigned_employee_id;

      if assigned_employee_uuid is null and assigned_employee_name is not null then
        select id into assigned_employee_uuid
        from public.employees
        where active = true and lower(trim(name)) = lower(trim(assigned_employee_name))
        limit 1;
      end if;
    end if;

    insert into public.job_tasks (
      job_id, title, assigned_to, assigned_employee_id, due_date, completed,
      automation_rule_id, automation_transition_id
    ) values (
      new.id, matching_rule.task_title, assigned_employee_name,
      assigned_employee_uuid, current_date + matching_rule.due_offset_days,
      false, matching_rule.id, transition_id
    )
    on conflict (automation_transition_id, automation_rule_id)
      where automation_transition_id is not null and automation_rule_id is not null
      do nothing
    returning id into created_task_id;

    if created_task_id is not null then
      insert into public.job_activities (
        job_id, activity_type, description, old_value, new_value
      ) values (
        new.id, 'task_automated',
        'Automation "' || matching_rule.name || '" created task: ' || matching_rule.task_title,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status
      );
    end if;

    assigned_employee_name := null;
    assigned_employee_uuid := null;
    created_task_id := null;
  end loop;

  return new;
end;
$$;

alter table public.employees enable row level security;

drop policy if exists "Authenticated users can view active employees" on public.employees;
create policy "Authenticated users can view active employees"
on public.employees for select to authenticated
using (active = true or auth_user_id = auth.uid());

commit;
