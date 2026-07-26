begin;

create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  author_employee_id uuid references public.employees(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_employee_id uuid references public.employees(id) on delete set null
);

create index if not exists job_notes_job_created_idx
  on public.job_notes(job_id, created_at desc)
  where deleted_at is null;

create or replace function public.set_job_note_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists job_notes_set_updated_at on public.job_notes;
create trigger job_notes_set_updated_at
before update of body on public.job_notes
for each row execute function public.set_job_note_updated_at();

insert into public.permission_definitions (key, name, description, category) values
  ('job_notes.view', 'View job notes', 'View durable notes recorded on jobs.', 'Jobs'),
  ('job_notes.create', 'Create job notes', 'Add durable notes to jobs.', 'Jobs'),
  ('job_notes.edit', 'Edit job notes', 'Edit job notes created by employees.', 'Jobs'),
  ('job_notes.delete', 'Delete job notes', 'Remove job notes while preserving audit history.', 'Destructive actions')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key from (values
  ('administrator', 'job_notes.view'), ('administrator', 'job_notes.create'), ('administrator', 'job_notes.edit'), ('administrator', 'job_notes.delete'),
  ('sales_manager', 'job_notes.view'), ('sales_manager', 'job_notes.create'), ('sales_manager', 'job_notes.edit'), ('sales_manager', 'job_notes.delete'),
  ('salesperson', 'job_notes.view'), ('salesperson', 'job_notes.create'), ('salesperson', 'job_notes.edit'),
  ('operations_manager', 'job_notes.view'), ('operations_manager', 'job_notes.create'), ('operations_manager', 'job_notes.edit'), ('operations_manager', 'job_notes.delete'),
  ('installer', 'job_notes.view'), ('installer', 'job_notes.create'),
  ('office_staff', 'job_notes.view'), ('office_staff', 'job_notes.create'), ('office_staff', 'job_notes.edit')
) as grants(role_key, permission_key)
on conflict do nothing;

alter table public.job_notes enable row level security;

drop policy if exists "Employees can view active job notes" on public.job_notes;
create policy "Employees can view active job notes"
on public.job_notes for select to authenticated
using (
  deleted_at is null and exists (
    select 1 from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'job_notes.view'
  )
);

commit;
