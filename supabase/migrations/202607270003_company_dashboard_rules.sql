begin;

create table if not exists public.dashboard_rule_settings (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  rule_group text not null check (rule_group in ('needs_attention', 'needs_my_attention')),
  employee_id uuid references public.employees(id) on delete cascade,
  enabled boolean not null default true,
  severity text not null default 'important'
    check (severity in ('critical', 'important', 'informational')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dashboard_rule_company_default_idx
  on public.dashboard_rule_settings(rule_key)
  where employee_id is null;

create unique index if not exists dashboard_rule_employee_override_idx
  on public.dashboard_rule_settings(rule_key, employee_id)
  where employee_id is not null;

create index if not exists dashboard_rule_enabled_group_idx
  on public.dashboard_rule_settings(rule_group, enabled)
  where employee_id is null;

insert into public.dashboard_rule_settings
  (rule_key, rule_group, enabled, severity, configuration)
values
  ('missing_qf_number', 'needs_attention', true, 'critical', '{}'),
  ('missing_contract_amount', 'needs_attention', true, 'critical', '{}'),
  ('missing_company_contact', 'needs_attention', false, 'informational', '{}'),
  ('missing_job_site_contact', 'needs_attention', false, 'informational', '{}'),
  ('missing_job_address', 'needs_attention', false, 'informational', '{}'),
  ('missing_layout', 'needs_attention', false, 'informational', '{}'),
  ('missing_photos', 'needs_attention', false, 'informational', '{}'),
  ('missing_files', 'needs_attention', false, 'informational', '{}'),
  ('missing_install_date', 'needs_attention', true, 'critical', '{}'),
  ('overdue_tasks', 'needs_attention', true, 'critical', '{}'),
  ('no_recent_activity', 'needs_attention', true, 'important', '{"days": 14}'),
  ('unassigned_appointments', 'needs_attention', true, 'critical', '{}'),
  ('jobs_assigned_to_me', 'needs_my_attention', false, 'informational', '{}'),
  ('tasks_assigned_to_me', 'needs_my_attention', false, 'important', '{}'),
  ('mentions_for_me', 'needs_my_attention', true, 'important', '{}'),
  ('jobs_awaiting_my_approval', 'needs_my_attention', true, 'important', '{}'),
  ('overdue_items_assigned_to_me', 'needs_my_attention', true, 'critical', '{}')
on conflict do nothing;

create or replace function public.set_dashboard_rule_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.rule_key := btrim(new.rule_key);
  if new.rule_key = '' then raise exception 'Rule key cannot be blank'; end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dashboard_rule_settings_updated_at
  on public.dashboard_rule_settings;
create trigger dashboard_rule_settings_updated_at
before insert or update on public.dashboard_rule_settings
for each row execute function public.set_dashboard_rule_updated_at();

alter table public.dashboard_rule_settings enable row level security;

drop policy if exists "Employees can view dashboard rule settings"
  on public.dashboard_rule_settings;
create policy "Employees can view dashboard rule settings"
on public.dashboard_rule_settings for select to authenticated
using (employee_id is null or employee_id = public.current_employee_id());

drop policy if exists "Administrators can manage dashboard rule settings"
  on public.dashboard_rule_settings;
create policy "Administrators can manage dashboard rule settings"
on public.dashboard_rule_settings for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

commit;
