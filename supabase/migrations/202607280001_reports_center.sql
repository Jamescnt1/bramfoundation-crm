begin;

create table if not exists public.report_favorites (
  employee_id uuid not null references public.employees(id) on delete cascade,
  report_id text not null check (char_length(trim(report_id)) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (employee_id, report_id)
);

create index if not exists report_favorites_employee_created_idx
  on public.report_favorites(employee_id, created_at);

alter table public.report_favorites enable row level security;

drop policy if exists "Employees can view their report favorites"
  on public.report_favorites;
create policy "Employees can view their report favorites"
on public.report_favorites for select to authenticated
using (employee_id = public.current_employee_id());

drop policy if exists "Employees can add their report favorites"
  on public.report_favorites;
create policy "Employees can add their report favorites"
on public.report_favorites for insert to authenticated
with check (employee_id = public.current_employee_id());

drop policy if exists "Employees can remove their report favorites"
  on public.report_favorites;
create policy "Employees can remove their report favorites"
on public.report_favorites for delete to authenticated
using (employee_id = public.current_employee_id());

create index if not exists jobs_reports_created_idx
  on public.jobs(created_at desc)
  where archived_at is null;
create index if not exists jobs_reports_updated_idx
  on public.jobs(updated_at desc, status)
  where archived_at is null;
create index if not exists job_activities_reports_created_idx
  on public.job_activities(created_at desc, activity_type, job_id);
create index if not exists job_tasks_reports_created_idx
  on public.job_tasks(created_at desc, status, assigned_employee_id);
create index if not exists job_tasks_reports_completed_idx
  on public.job_tasks(completed_at desc, assigned_employee_id)
  where completed_at is not null;
create index if not exists appointments_reports_starts_idx
  on public.appointments(starts_at desc, status, appointment_type);
create index if not exists appointments_reports_employee_idx
  on public.appointments(assigned_employee_id, starts_at desc);
create index if not exists job_attachments_reports_created_idx
  on public.job_attachments(created_at desc, attachment_kind, category)
  where archived_at is null;
create index if not exists job_layouts_reports_created_idx
  on public.job_layouts(created_at desc, record_kind)
  where archived_at is null;
create index if not exists messages_reports_created_idx
  on public.messages(created_at desc, sender_employee_id)
  where deleted_at is null;

commit;
