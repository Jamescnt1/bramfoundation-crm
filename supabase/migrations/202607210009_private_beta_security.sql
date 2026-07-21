begin;

create or replace function public.current_employee_is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active = true
  );
$$;
revoke all on function public.current_employee_is_active() from public;
grant execute on function public.current_employee_is_active() to authenticated;

drop policy if exists "Allow public automation rule reads" on public.automation_rules;
drop policy if exists "Allow public automation rule inserts" on public.automation_rules;
drop policy if exists "Allow public automation rule updates" on public.automation_rules;
drop policy if exists "Allow public automation rule deletes" on public.automation_rules;
drop policy if exists "Allow public automation rule reads" on public.task_automation_rules;
drop policy if exists "Allow public automation rule inserts" on public.task_automation_rules;
drop policy if exists "Allow public automation rule updates" on public.task_automation_rules;
drop policy if exists "Allow public automation rule deletes" on public.task_automation_rules;
drop policy if exists "Pipeline configuration is readable" on public.pipeline_stages;
drop policy if exists "Pipeline aliases are readable" on public.pipeline_stage_aliases;

alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.appointments enable row level security;
alter table public.job_activities enable row level security;
alter table public.job_tasks enable row level security;

drop policy if exists "Active employees can access customers" on public.customers;
create policy "Active employees can access customers" on public.customers
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can access jobs" on public.jobs;
create policy "Active employees can access jobs" on public.jobs
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can access appointments" on public.appointments;
create policy "Active employees can access appointments" on public.appointments
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can access job activities" on public.job_activities;
create policy "Active employees can access job activities" on public.job_activities
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can access tasks" on public.job_tasks;
create policy "Active employees can access tasks" on public.job_tasks
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());

commit;
