begin;

drop trigger if exists job_tasks_prevent_duplicate_automation on public.job_tasks;
drop function if exists public.prevent_duplicate_open_automation_task();
drop index if exists public.job_tasks_open_automation_lookup_idx;

commit;
