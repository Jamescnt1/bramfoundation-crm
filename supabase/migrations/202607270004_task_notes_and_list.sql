begin;

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.job_tasks(id) on delete cascade,
  author_employee_id uuid references public.employees(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  source text not null default 'employee_note'
    check (source in ('employee_note', 'legacy_description')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_employee_id uuid references public.employees(id) on delete set null
);

create index if not exists task_notes_task_created_idx
  on public.task_notes(task_id, created_at desc)
  where deleted_at is null;

create index if not exists task_notes_author_idx
  on public.task_notes(author_employee_id, created_at desc)
  where deleted_at is null;

create or replace function public.set_task_note_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists task_notes_set_updated_at on public.task_notes;
create trigger task_notes_set_updated_at
before update of body on public.task_notes
for each row execute function public.set_task_note_updated_at();

insert into public.task_notes (
  task_id,
  author_employee_id,
  body,
  source,
  created_at,
  updated_at
)
select
  task.id,
  null,
  trim(task.description),
  'legacy_description',
  task.created_at,
  task.created_at
from public.job_tasks task
where nullif(trim(task.description), '') is not null
  and not exists (
    select 1
    from public.task_notes note
    where note.task_id = task.id
      and note.source = 'legacy_description'
  );

alter table public.task_notes enable row level security;

drop policy if exists "Active employees can view task notes" on public.task_notes;
create policy "Active employees can view task notes"
on public.task_notes for select to authenticated
using (
  deleted_at is null
  and public.current_employee_is_active()
);

create or replace view public.task_latest_notes
with (security_invoker = true)
as
select distinct on (note.task_id)
  note.id,
  note.task_id,
  note.author_employee_id,
  note.body,
  note.source,
  note.created_at,
  note.updated_at,
  employee.name as author_name
from public.task_notes note
left join public.employees employee on employee.id = note.author_employee_id
where note.deleted_at is null
order by note.task_id, note.created_at desc, note.id desc;

grant select on public.task_latest_notes to authenticated;

commit;
