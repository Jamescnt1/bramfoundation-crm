begin;

alter table public.job_tasks
  add column if not exists snoozed_until timestamptz;

comment on column public.job_tasks.snoozed_until is
  'Employee-selected time when an active task returns to general task queues. Job-scoped task views continue to show it.';

create index if not exists job_tasks_snoozed_assignment_idx
  on public.job_tasks(snoozed_until, assigned_employee_id, status)
  where snoozed_until is not null;

commit;
