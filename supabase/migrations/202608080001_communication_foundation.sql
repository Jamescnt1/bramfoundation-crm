begin;

create table if not exists public.communication_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  email_notifications_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  scheduled_communications_enabled boolean not null default false,
  automated_communications_enabled boolean not null default false,
  trial_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.communication_settings (singleton_key)
values (true)
on conflict (singleton_key) do nothing;

create table if not exists public.employee_communication_preferences (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  appointment_notifications boolean not null default true,
  task_notifications boolean not null default true,
  internal_message_notifications boolean not null default true,
  job_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.employee_communication_preferences (employee_id)
select employee.id from public.employees employee
on conflict (employee_id) do nothing;

create table if not exists public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('customer', 'employee', 'installer')),
  recipient_id uuid,
  phone_number text not null,
  status text not null default 'unknown' check (status in ('unknown', 'opted_in', 'opted_out')),
  consent_method text,
  consent_recorded_at timestamptz,
  opted_out_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_consents_recipient_phone_idx
  on public.communication_consents(recipient_type, recipient_id, phone_number)
  nulls not distinct;

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  channel text not null check (channel in ('email', 'sms')),
  audience text not null check (audience in ('customer', 'employee', 'installer')),
  subject text,
  body text not null check (char_length(btrim(body)) between 1 and 50000),
  active boolean not null default true,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel <> 'email' or nullif(btrim(subject), '') is not null)
);

create unique index if not exists communication_templates_name_channel_audience_idx
  on public.communication_templates(lower(name), channel, audience);

create table if not exists public.communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms')),
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  recipient_type text not null check (recipient_type in ('customer', 'employee', 'installer')),
  recipient_id uuid,
  recipient_address text not null,
  sender_address text,
  subject text,
  body text not null,
  status text not null default 'queued'
    check (status in ('draft', 'scheduled', 'queued', 'processing', 'sent', 'delivered', 'failed', 'undelivered', 'canceled')),
  job_id uuid references public.jobs(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  recipient_employee_id uuid references public.employees(id) on delete set null,
  template_id uuid references public.communication_templates(id) on delete set null,
  sent_by_employee_id uuid references public.employees(id) on delete set null,
  automation_rule_id uuid references public.automation_rules(id) on delete set null,
  source_customer_email_id uuid references public.customer_emails(id) on delete set null,
  idempotency_key text,
  provider text,
  provider_message_id text,
  failure_reason text,
  consent_status text check (consent_status is null or consent_status in ('unknown', 'opted_in', 'opted_out', 'not_required')),
  is_automated boolean not null default false,
  scheduled_for timestamptz,
  processing_started_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_deliveries_idempotency_idx
  on public.communication_deliveries(idempotency_key)
  where idempotency_key is not null;
create unique index if not exists communication_deliveries_provider_message_idx
  on public.communication_deliveries(provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists communication_deliveries_job_created_idx
  on public.communication_deliveries(job_id, created_at desc)
  where job_id is not null;
create index if not exists communication_deliveries_appointment_created_idx
  on public.communication_deliveries(appointment_id, created_at desc)
  where appointment_id is not null;
create index if not exists communication_deliveries_pending_idx
  on public.communication_deliveries(scheduled_for, created_at)
  where status in ('scheduled', 'queued');

create table if not exists public.communication_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_message_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create or replace function public.set_communication_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists communication_settings_updated_at on public.communication_settings;
create trigger communication_settings_updated_at before update on public.communication_settings
for each row execute function public.set_communication_updated_at();
drop trigger if exists employee_communication_preferences_updated_at on public.employee_communication_preferences;
create trigger employee_communication_preferences_updated_at before update on public.employee_communication_preferences
for each row execute function public.set_communication_updated_at();
drop trigger if exists communication_consents_updated_at on public.communication_consents;
create trigger communication_consents_updated_at before update on public.communication_consents
for each row execute function public.set_communication_updated_at();
drop trigger if exists communication_templates_updated_at on public.communication_templates;
create trigger communication_templates_updated_at before update on public.communication_templates
for each row execute function public.set_communication_updated_at();
drop trigger if exists communication_deliveries_updated_at on public.communication_deliveries;
create trigger communication_deliveries_updated_at before update on public.communication_deliveries
for each row execute function public.set_communication_updated_at();

insert into public.permission_definitions (key, name, description, category) values
  ('communications.view', 'View communications', 'View authorized email and text delivery history.', 'Communications'),
  ('communications.send', 'Send communications', 'Send authorized email and text communications.', 'Communications'),
  ('communications.manage', 'Manage communications', 'Configure company communication rules, templates, and preferences.', 'Administration')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (role_key, permission_key) values
  ('administrator', 'communications.view'), ('administrator', 'communications.send'), ('administrator', 'communications.manage'),
  ('sales_manager', 'communications.view'), ('sales_manager', 'communications.send'),
  ('salesperson', 'communications.view'), ('salesperson', 'communications.send'),
  ('operations_manager', 'communications.view'), ('operations_manager', 'communications.send'),
  ('office_staff', 'communications.view'), ('office_staff', 'communications.send')
on conflict do nothing;

alter table public.communication_settings enable row level security;
alter table public.employee_communication_preferences enable row level security;
alter table public.communication_consents enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_deliveries enable row level security;
alter table public.communication_webhook_events enable row level security;

drop policy if exists "Employees can view communication settings" on public.communication_settings;
create policy "Employees can view communication settings" on public.communication_settings
for select to authenticated using (public.current_employee_is_active());
drop policy if exists "Administrators can manage communication settings" on public.communication_settings;
create policy "Administrators can manage communication settings" on public.communication_settings
for all to authenticated using (public.current_employee_is_administrator()) with check (public.current_employee_is_administrator());

drop policy if exists "Employees can view communication preferences" on public.employee_communication_preferences;
create policy "Employees can view communication preferences" on public.employee_communication_preferences
for select to authenticated using (employee_id = public.current_employee_id() or public.current_employee_is_administrator());
drop policy if exists "Employees can update their communication preferences" on public.employee_communication_preferences;
create policy "Employees can update their communication preferences" on public.employee_communication_preferences
for update to authenticated using (employee_id = public.current_employee_id() or public.current_employee_is_administrator())
with check (employee_id = public.current_employee_id() or public.current_employee_is_administrator());
drop policy if exists "Administrators can create communication preferences" on public.employee_communication_preferences;
create policy "Administrators can create communication preferences" on public.employee_communication_preferences
for insert to authenticated with check (public.current_employee_is_administrator());

drop policy if exists "Administrators can manage communication consent" on public.communication_consents;
create policy "Administrators can manage communication consent" on public.communication_consents
for all to authenticated using (public.current_employee_is_administrator()) with check (public.current_employee_is_administrator());
drop policy if exists "Employees can view active communication templates" on public.communication_templates;
create policy "Employees can view active communication templates" on public.communication_templates
for select to authenticated using (active and public.current_employee_is_active());
drop policy if exists "Administrators can manage communication templates" on public.communication_templates;
create policy "Administrators can manage communication templates" on public.communication_templates
for all to authenticated using (public.current_employee_is_administrator()) with check (public.current_employee_is_administrator());

drop policy if exists "Employees can view authorized communication deliveries" on public.communication_deliveries;
create policy "Employees can view authorized communication deliveries" on public.communication_deliveries
for select to authenticated using (
  recipient_employee_id = public.current_employee_id()
  or (job_id is not null and public.employee_can_access_job(job_id))
  or public.current_employee_is_administrator()
);

drop policy if exists "Administrators can view communication webhook events" on public.communication_webhook_events;
create policy "Administrators can view communication webhook events" on public.communication_webhook_events
for select to authenticated using (public.current_employee_is_administrator());

commit;
