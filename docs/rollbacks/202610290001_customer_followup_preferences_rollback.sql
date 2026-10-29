begin;

drop trigger if exists job_tasks_00_respect_customer_followups on public.job_tasks;
drop function if exists public.respect_customer_followup_preferences();

alter table public.customers
  drop column if exists lead_followups_enabled,
  drop column if exists estimate_followups_enabled;

commit;

-- This schema rollback does not reopen follow-up tasks that a user intentionally
-- cancelled by turning a customer preference off.
