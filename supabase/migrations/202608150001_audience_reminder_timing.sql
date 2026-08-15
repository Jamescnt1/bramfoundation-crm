begin;

alter table public.communication_settings
  add column if not exists calendar_customer_reminder_hours_before integer,
  add column if not exists calendar_employee_reminder_hours_before integer,
  add column if not exists calendar_installer_reminder_hours_before integer;

update public.communication_settings
set
  calendar_customer_reminder_hours_before = coalesce(calendar_customer_reminder_hours_before, appointment_reminder_hours_before),
  calendar_employee_reminder_hours_before = coalesce(calendar_employee_reminder_hours_before, appointment_reminder_hours_before),
  calendar_installer_reminder_hours_before = coalesce(calendar_installer_reminder_hours_before, appointment_reminder_hours_before);

alter table public.communication_settings
  alter column calendar_customer_reminder_hours_before set default 24,
  alter column calendar_customer_reminder_hours_before set not null,
  alter column calendar_employee_reminder_hours_before set default 24,
  alter column calendar_employee_reminder_hours_before set not null,
  alter column calendar_installer_reminder_hours_before set default 24,
  alter column calendar_installer_reminder_hours_before set not null;

alter table public.communication_settings
  drop constraint if exists communication_settings_customer_reminder_hours_check,
  drop constraint if exists communication_settings_employee_reminder_hours_check,
  drop constraint if exists communication_settings_installer_reminder_hours_check;

alter table public.communication_settings
  add constraint communication_settings_customer_reminder_hours_check
    check (calendar_customer_reminder_hours_before between 1 and 720),
  add constraint communication_settings_employee_reminder_hours_check
    check (calendar_employee_reminder_hours_before between 1 and 720),
  add constraint communication_settings_installer_reminder_hours_check
    check (calendar_installer_reminder_hours_before between 1 and 720);

commit;
