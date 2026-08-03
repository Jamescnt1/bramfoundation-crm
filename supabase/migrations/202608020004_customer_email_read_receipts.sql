begin;

create table if not exists public.customer_email_read_receipts (
  email_id uuid not null references public.customer_emails(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (email_id, employee_id)
);

create index if not exists customer_email_read_receipts_employee_idx
  on public.customer_email_read_receipts(employee_id, read_at desc);

alter table public.customer_email_read_receipts enable row level security;

drop policy if exists "Employees can view their customer email read receipts"
on public.customer_email_read_receipts;
create policy "Employees can view their customer email read receipts"
on public.customer_email_read_receipts
for select to authenticated
using (employee_id = public.current_employee_id());

drop policy if exists "Employees can create their customer email read receipts"
on public.customer_email_read_receipts;
create policy "Employees can create their customer email read receipts"
on public.customer_email_read_receipts
for insert to authenticated
with check (
  employee_id = public.current_employee_id()
  and exists (
    select 1 from public.customer_emails email
    where email.id = email_id
      and email.direction = 'inbound'
      and public.employee_can_access_job(email.job_id)
  )
);

drop policy if exists "Employees can update their customer email read receipts"
on public.customer_email_read_receipts;
create policy "Employees can update their customer email read receipts"
on public.customer_email_read_receipts
for update to authenticated
using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

drop policy if exists "Employees can delete their customer email read receipts"
on public.customer_email_read_receipts;
create policy "Employees can delete their customer email read receipts"
on public.customer_email_read_receipts
for delete to authenticated
using (employee_id = public.current_employee_id());

commit;
