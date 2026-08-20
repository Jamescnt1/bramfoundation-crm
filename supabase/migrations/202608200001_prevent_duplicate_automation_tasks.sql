begin;

create index if not exists job_tasks_open_automation_lookup_idx
  on public.job_tasks (
    automation_rule_id,
    job_id,
    customer_id,
    assigned_employee_id,
    title
  )
  where automation_rule_id is not null
    and completed = false
    and coalesce(status, 'open') not in ('completed', 'cancelled');

create or replace function public.prevent_duplicate_open_automation_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.automation_rule_id is null then
    return new;
  end if;

  -- Serialize attempts for the same rule/record/employee so simultaneous
  -- automation events cannot both pass the open-task check.
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(
      ':',
      new.automation_rule_id::text,
      coalesce(new.job_id::text, ''),
      coalesce(new.customer_id::text, ''),
      coalesce(new.assigned_employee_id::text, ''),
      new.title
    ),
    0
  ));

  if exists (
    select 1
    from public.job_tasks existing
    where existing.automation_rule_id = new.automation_rule_id
      and existing.job_id is not distinct from new.job_id
      and existing.customer_id is not distinct from new.customer_id
      and existing.assigned_employee_id is not distinct from new.assigned_employee_id
      and existing.title = new.title
      and existing.completed = false
      and coalesce(existing.status, 'open') not in ('completed', 'cancelled')
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists job_tasks_prevent_duplicate_automation on public.job_tasks;
create trigger job_tasks_prevent_duplicate_automation
before insert on public.job_tasks
for each row execute function public.prevent_duplicate_open_automation_task();

commit;
