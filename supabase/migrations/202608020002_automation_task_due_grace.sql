begin;

alter table public.automation_rules
  add column if not exists overdue_grace_days integer not null default 1;

alter table public.automation_rules
  drop constraint if exists automation_rules_overdue_grace_days_check;
alter table public.automation_rules
  add constraint automation_rules_overdue_grace_days_check
  check (overdue_grace_days >= 0 and overdue_grace_days <= 365);

alter table public.job_tasks
  add column if not exists overdue_grace_days integer not null default 0;

alter table public.job_tasks
  drop constraint if exists job_tasks_overdue_grace_days_check;
alter table public.job_tasks
  add constraint job_tasks_overdue_grace_days_check
  check (overdue_grace_days >= 0 and overdue_grace_days <= 365);

update public.job_tasks task
set overdue_grace_days = rule.overdue_grace_days
from public.automation_rules rule
where task.automation_rule_id = rule.id;

create or replace function public.apply_automation_task_type()
returns trigger language plpgsql set search_path = public as $$
declare
  selected_type_id uuid;
  selected_grace_days integer;
begin
  if new.automation_rule_id is null then return new; end if;

  select task_type_id, overdue_grace_days
  into selected_type_id, selected_grace_days
  from public.automation_rules
  where id = new.automation_rule_id;

  new.task_type_id := coalesce(selected_type_id, new.task_type_id);
  new.overdue_grace_days := coalesce(selected_grace_days, 0);
  return new;
end;
$$;

commit;
