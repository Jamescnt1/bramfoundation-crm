begin;

alter table public.customers
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.employees(id) on delete set null;

alter table public.jobs
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.employees(id) on delete set null;

alter table public.employees
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.employees(id) on delete set null;

create index if not exists customers_active_idx
  on public.customers(full_name) where archived_at is null;
create index if not exists jobs_active_idx
  on public.jobs(created_at desc) where archived_at is null;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid references public.employees(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  entity_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_entity_idx
  on public.admin_audit_log(entity_type, entity_id, created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_employee_id, created_at desc);

insert into public.permission_definitions (key, name, description, category) values
  ('delete_employees', 'Deactivate employees', 'Deactivate employee access while preserving assignments and history.', 'Destructive actions'),
  ('delete_customers', 'Archive customers', 'Archive customer records while preserving linked jobs and history.', 'Destructive actions'),
  ('delete_leads', 'Archive leads', 'Archive lead/job records while preserving related customer records and activity.', 'Destructive actions')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (role_key, permission_key) values
  ('administrator', 'delete_employees'),
  ('administrator', 'delete_customers'),
  ('administrator', 'delete_leads')
on conflict do nothing;

alter table public.admin_audit_log enable row level security;

drop policy if exists "Administrators can view audit log" on public.admin_audit_log;
create policy "Administrators can view audit log"
on public.admin_audit_log for select to authenticated
using (public.current_employee_is_administrator());

commit;
