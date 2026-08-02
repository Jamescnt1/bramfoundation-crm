begin;

alter table public.automation_rules
  add column if not exists task_type_id uuid
  references public.task_types(id) on delete set null;

create index if not exists automation_rules_task_type_idx
  on public.automation_rules(task_type_id)
  where task_type_id is not null;

create or replace function public.apply_automation_task_type()
returns trigger language plpgsql set search_path = public as $$
declare selected_type_id uuid;
begin
  if new.automation_rule_id is null then return new; end if;
  select task_type_id into selected_type_id
  from public.automation_rules where id = new.automation_rule_id;
  new.task_type_id := coalesce(selected_type_id, new.task_type_id);
  return new;
end;
$$;

drop trigger if exists job_tasks_apply_automation_task_type on public.job_tasks;
create trigger job_tasks_apply_automation_task_type
before insert or update of automation_rule_id on public.job_tasks
for each row execute function public.apply_automation_task_type();

commit;
