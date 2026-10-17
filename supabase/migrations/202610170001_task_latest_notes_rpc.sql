begin;

create or replace function public.get_latest_task_notes_for_tasks(task_ids uuid[])
returns table (
  id uuid,
  task_id uuid,
  author_employee_id uuid,
  body text,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    note.id,
    note.task_id,
    note.author_employee_id,
    note.body,
    note.source,
    note.created_at,
    note.updated_at,
    note.author_name
  from public.task_latest_notes note
  where note.task_id = any(task_ids)
  order by note.created_at desc;
$$;

revoke all on function public.get_latest_task_notes_for_tasks(uuid[]) from public;
grant execute on function public.get_latest_task_notes_for_tasks(uuid[]) to authenticated;

commit;
