begin;

alter table public.communication_settings
  add column if not exists calendar_customer_notifications_enabled boolean not null default false,
  add column if not exists calendar_employee_notifications_enabled boolean not null default false,
  add column if not exists calendar_installer_notifications_enabled boolean not null default false;

commit;
