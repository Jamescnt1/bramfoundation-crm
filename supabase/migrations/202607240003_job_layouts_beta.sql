begin;

create table if not exists public.job_layouts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  document_data jsonb not null,
  page_count integer not null default 1 check (page_count between 1 and 50),
  preview_storage_path text,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by_employee_id uuid references public.employees(id) on delete set null
);

create index if not exists job_layouts_active_job_updated_idx
  on public.job_layouts(job_id, updated_at desc)
  where archived_at is null;
create index if not exists job_layouts_creator_idx
  on public.job_layouts(created_by_employee_id);

create or replace function public.set_job_layout_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists job_layouts_set_updated_at on public.job_layouts;
create trigger job_layouts_set_updated_at
before update on public.job_layouts
for each row execute function public.set_job_layout_updated_at();

insert into public.permission_definitions (key, name, description, category) values
  ('layouts.view', 'View job layouts', 'View editable layouts for accessible jobs.', 'Jobs'),
  ('layouts.manage', 'Manage job layouts', 'Create, draw, autosave, and export job layouts.', 'Jobs'),
  ('layouts.archive', 'Archive job layouts', 'Archive layouts while preserving job history.', 'Destructive actions')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from (values
  ('administrator', 'layouts.view'), ('administrator', 'layouts.manage'), ('administrator', 'layouts.archive'),
  ('sales_manager', 'layouts.view'), ('sales_manager', 'layouts.manage'), ('sales_manager', 'layouts.archive'),
  ('salesperson', 'layouts.view'), ('salesperson', 'layouts.manage'),
  ('operations_manager', 'layouts.view'), ('operations_manager', 'layouts.manage'), ('operations_manager', 'layouts.archive'),
  ('installer', 'layouts.view'), ('installer', 'layouts.manage'),
  ('office_staff', 'layouts.view'), ('office_staff', 'layouts.manage')
) as permissions(role_key, permission_key)
on conflict do nothing;

alter table public.job_layouts enable row level security;

drop policy if exists "Employees can view active job layouts" on public.job_layouts;
create policy "Employees can view active job layouts"
on public.job_layouts for select to authenticated
using (
  archived_at is null
  and exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'layouts.view'
  )
);

drop policy if exists "Layout managers can insert layouts" on public.job_layouts;
create policy "Layout managers can insert layouts"
on public.job_layouts for insert to authenticated
with check (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'layouts.manage'
      and e.id = created_by_employee_id
  )
);

drop policy if exists "Layout managers can update layouts" on public.job_layouts;
create policy "Layout managers can update layouts"
on public.job_layouts for update to authenticated
using (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('layouts.manage', 'layouts.archive')
  )
)
with check (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('layouts.manage', 'layouts.archive')
  )
);

commit;
