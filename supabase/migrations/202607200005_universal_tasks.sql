begin;

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.task_types (name, sort_order)
values
  ('Sales', 0), ('Operations', 1), ('Installation', 2), ('Office', 3),
  ('Inventory', 4), ('Accounting', 5), ('Personal', 6), ('General', 7)
on conflict (name) do nothing;

alter table public.job_tasks alter column job_id drop not null;
alter table public.job_tasks
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists description text,
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists due_at timestamptz,
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'open',
  add column if not exists task_type_id uuid references public.task_types(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.job_tasks task
set customer_id = job.customer_id
from public.jobs job
where task.job_id = job.id and task.customer_id is null;

update public.job_tasks
set due_at = due_date::timestamp at time zone 'America/Phoenix' + interval '17 hours'
where due_date is not null and due_at is null;

update public.job_tasks
set status = case when completed then 'completed' else 'open' end
where status is null or status = 'open';

update public.job_tasks task
set assigned_employee_id = employee.id
from public.employees employee
where task.assigned_employee_id is null
  and task.assigned_to is not null
  and lower(task.assigned_to) = lower(employee.name);

update public.job_tasks
set task_type_id = (select id from public.task_types where name = 'General')
where task_type_id is null;

alter table public.job_tasks drop constraint if exists job_tasks_priority_check;
alter table public.job_tasks add constraint job_tasks_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));
alter table public.job_tasks drop constraint if exists job_tasks_status_check;
alter table public.job_tasks add constraint job_tasks_status_check
  check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled'));

create index if not exists job_tasks_customer_id_idx on public.job_tasks(customer_id);
create index if not exists job_tasks_assigned_employee_id_idx on public.job_tasks(assigned_employee_id);
create index if not exists job_tasks_due_at_idx on public.job_tasks(due_at);
create index if not exists job_tasks_task_type_id_idx on public.job_tasks(task_type_id);

create or replace function public.validate_task_relationships()
returns trigger language plpgsql set search_path = public as $$
declare linked_customer_id uuid;
begin
  if new.job_id is not null then
    select customer_id into linked_customer_id from public.jobs where id = new.job_id;
    if not found then raise exception 'Selected job does not exist'; end if;
    if new.customer_id is not null and linked_customer_id is distinct from new.customer_id then
      raise exception 'Selected job does not belong to the selected customer';
    end if;
    new.customer_id := linked_customer_id;
  end if;
  new.completed := new.status = 'completed';
  new.completed_at := case
    when new.status = 'completed' then coalesce(new.completed_at, now())
    else null
  end;
  new.due_date := case when new.due_at is null then null else new.due_at::date end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_tasks_validate_relationships on public.job_tasks;
create trigger job_tasks_validate_relationships
before insert or update on public.job_tasks
for each row execute function public.validate_task_relationships();

alter table public.task_types enable row level security;
drop policy if exists "Authenticated users can view task types" on public.task_types;
create policy "Authenticated users can view task types" on public.task_types for select to authenticated using (true);
drop policy if exists "Administrators can manage task types" on public.task_types;
create policy "Administrators can manage task types" on public.task_types for all to authenticated
using (exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and e.role = 'administrator'))
with check (exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and e.role = 'administrator'));

commit;
