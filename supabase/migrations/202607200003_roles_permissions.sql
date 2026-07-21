begin;

create table if not exists public.role_definitions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,49}$'),
  name text not null,
  description text,
  system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permission_definitions (
  key text primary key,
  name text not null,
  description text,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_key text not null references public.role_definitions(key) on delete cascade,
  permission_key text not null references public.permission_definitions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

insert into public.role_definitions (key, name, description, system) values
  ('administrator', 'Administrator', 'Full access to Foundation CRM.', true),
  ('sales_manager', 'Sales Manager', 'Manages sales staff, customers, jobs, and reporting.', true),
  ('salesperson', 'Salesperson', 'Manages assigned leads, jobs, tasks, and appointments.', true),
  ('operations_manager', 'Operations Manager', 'Manages production, scheduling, and operations.', true),
  ('installer', 'Installer', 'Views assigned installation work, tasks, and appointments.', true),
  ('office_staff', 'Office Staff', 'Manages customers, scheduling, and daily office work.', true)
on conflict (key) do update set name = excluded.name, description = excluded.description;

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees drop constraint if exists employees_role_fkey;
alter table public.employees
  add constraint employees_role_fkey foreign key (role)
  references public.role_definitions(key) on update cascade;

insert into public.permission_definitions (key, name, description, category) values
  ('company_dashboard.view', 'View company dashboard', 'View company-wide operational metrics.', 'Dashboards'),
  ('customers.manage', 'Manage customers', 'Create and update customer records.', 'CRM'),
  ('jobs.manage', 'Manage jobs', 'Create and update jobs and leads.', 'CRM'),
  ('pipeline.manage', 'Manage pipeline', 'Move jobs through pipeline stages.', 'CRM'),
  ('calendar.manage', 'Manage calendar', 'Create and update appointments.', 'Scheduling'),
  ('tasks.manage', 'Manage tasks', 'Create, assign, and complete tasks.', 'Work'),
  ('reports.view', 'View reports', 'View company reports and analytics.', 'Reporting'),
  ('automations.manage', 'Manage automations', 'Configure automation rules.', 'Administration'),
  ('employees.manage', 'Manage employees', 'Create employees and control account status.', 'Administration'),
  ('roles.manage', 'Manage roles', 'Configure role permission assignments.', 'Administration')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (role_key, permission_key)
select 'administrator', key from public.permission_definitions
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key) values
  ('sales_manager', 'company_dashboard.view'), ('sales_manager', 'customers.manage'),
  ('sales_manager', 'jobs.manage'), ('sales_manager', 'pipeline.manage'),
  ('sales_manager', 'calendar.manage'), ('sales_manager', 'tasks.manage'),
  ('sales_manager', 'reports.view'),
  ('salesperson', 'customers.manage'), ('salesperson', 'jobs.manage'),
  ('salesperson', 'pipeline.manage'), ('salesperson', 'calendar.manage'),
  ('salesperson', 'tasks.manage'),
  ('operations_manager', 'company_dashboard.view'), ('operations_manager', 'customers.manage'),
  ('operations_manager', 'jobs.manage'), ('operations_manager', 'pipeline.manage'),
  ('operations_manager', 'calendar.manage'), ('operations_manager', 'tasks.manage'),
  ('operations_manager', 'reports.view'),
  ('installer', 'calendar.manage'), ('installer', 'tasks.manage'),
  ('office_staff', 'customers.manage'), ('office_staff', 'jobs.manage'),
  ('office_staff', 'calendar.manage'), ('office_staff', 'tasks.manage')
on conflict do nothing;

alter table public.role_definitions enable row level security;
alter table public.permission_definitions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "Authenticated users can view roles" on public.role_definitions;
create policy "Authenticated users can view roles" on public.role_definitions
for select to authenticated using (true);
drop policy if exists "Authenticated users can view permissions" on public.permission_definitions;
create policy "Authenticated users can view permissions" on public.permission_definitions
for select to authenticated using (true);
drop policy if exists "Authenticated users can view role permissions" on public.role_permissions;
create policy "Authenticated users can view role permissions" on public.role_permissions
for select to authenticated using (true);

commit;
