begin;

alter table public.employees
  add column if not exists username text;

create unique index if not exists employees_username_lower_idx
  on public.employees(lower(username)) where username is not null;

create or replace function public.current_employee_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and active = true
      and role = 'administrator'
  );
$$;

revoke all on function public.current_employee_is_administrator() from public;
grant execute on function public.current_employee_is_administrator() to authenticated;

drop policy if exists "Administrators can view all employees" on public.employees;
create policy "Administrators can view all employees"
on public.employees for select to authenticated
using (public.current_employee_is_administrator());

commit;
