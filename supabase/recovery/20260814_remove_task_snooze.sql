begin;

-- Emergency rollback for 202608140001_task_snooze.sql.
-- This removes saved snooze dates but leaves every task and its status intact.
drop index if exists public.job_tasks_snoozed_assignment_idx;
alter table public.job_tasks drop column if exists snoozed_until;

commit;
