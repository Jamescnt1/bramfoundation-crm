begin;

-- The employee dashboard uses the signed-in Supabase session. Permit each
-- active employee to read only tasks assigned to their own employee record.
alter table public.job_tasks enable row level security;

drop policy if exists "Authenticated employees can view assigned tasks"
  on public.job_tasks;

create policy "Authenticated employees can view assigned tasks"
on public.job_tasks
for select
to authenticated
using (
  assigned_employee_id in (
    select employee.id
    from public.employees employee
    where employee.auth_user_id = auth.uid()
      and employee.active = true
  )
);

commit;
