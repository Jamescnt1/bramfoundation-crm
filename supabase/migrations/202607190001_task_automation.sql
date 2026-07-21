begin;

create table if not exists public.task_automation_rules (
  id uuid primary key default gen_random_uuid(),
  status text not null unique,
  task_title text not null,
  due_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_automation_rules_due_days_check
    check (due_days is null or due_days >= 0)
);

comment on table public.task_automation_rules is
  'Configurable tasks created when a job enters a pipeline status.';

alter table public.job_tasks
  add column if not exists automation_rule_id uuid
    references public.task_automation_rules(id) on delete set null,
  add column if not exists automation_transition_id uuid;

create unique index if not exists job_tasks_automation_transition_idx
  on public.job_tasks(automation_transition_id)
  where automation_transition_id is not null;

insert into public.task_automation_rules (
  status,
  task_title,
  due_days,
  active
)
values
  ('New Lead', 'Call customer', 1, true),
  ('Estimate Sent', 'Follow up on estimate', 3, true),
  ('Approved', 'Order materials', null, true),
  ('Materials Ordered', 'Confirm material arrival', null, true),
  ('Install Scheduled', 'Confirm installation with customer', null, true),
  ('Complete', 'Request customer review', null, true)
on conflict (status) do update
set
  task_title = excluded.task_title,
  due_days = excluded.due_days,
  active = excluded.active,
  updated_at = now();

create or replace function public.set_task_automation_rule_updated_at()
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
  on public.task_automation_rules;

create trigger task_automation_rules_set_updated_at
before update on public.task_automation_rules
for each row
execute function public.set_task_automation_rule_updated_at();

create or replace function public.create_automated_task_for_job_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_rule public.task_automation_rules%rowtype;
  transition_id uuid := gen_random_uuid();
  task_due_date date;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select *
  into matching_rule
  from public.task_automation_rules
  where status = new.status
    and active = true;

  if not found then
    return new;
  end if;

  task_due_date := case
    when matching_rule.due_days is null then null
    else current_date + matching_rule.due_days
  end;

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
    new.salesperson,
    task_due_date,
    false,
    matching_rule.id,
    transition_id
  )
  on conflict (automation_transition_id) do nothing;

  if found then
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
      'Automatic task created: ' || matching_rule.task_title,
      case when tg_op = 'UPDATE' then old.status else null end,
      new.status
    );
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_create_automated_status_task on public.jobs;

create trigger jobs_create_automated_status_task
after insert or update of status on public.jobs
for each row
execute function public.create_automated_task_for_job_status();

alter table public.task_automation_rules enable row level security;

drop policy if exists "Allow public automation rule reads"
  on public.task_automation_rules;
create policy "Allow public automation rule reads"
on public.task_automation_rules
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public automation rule inserts"
  on public.task_automation_rules;
create policy "Allow public automation rule inserts"
on public.task_automation_rules
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public automation rule updates"
  on public.task_automation_rules;
create policy "Allow public automation rule updates"
on public.task_automation_rules
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow public automation rule deletes"
  on public.task_automation_rules;
create policy "Allow public automation rule deletes"
on public.task_automation_rules
for delete
to anon, authenticated
using (true);

commit;
