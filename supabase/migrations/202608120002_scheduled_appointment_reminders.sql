begin;

alter table public.communication_settings
  add column if not exists appointment_reminder_hours_before integer not null default 24,
  add column if not exists calendar_customer_reminder_channel text not null default 'email',
  add column if not exists calendar_employee_reminder_channel text not null default 'email',
  add column if not exists calendar_installer_reminder_channel text not null default 'sms';

alter table public.communication_settings
  drop constraint if exists communication_settings_reminder_hours_check,
  drop constraint if exists communication_settings_customer_reminder_channel_check,
  drop constraint if exists communication_settings_employee_reminder_channel_check,
  drop constraint if exists communication_settings_installer_reminder_channel_check;

alter table public.communication_settings
  add constraint communication_settings_reminder_hours_check
    check (appointment_reminder_hours_before between 1 and 168),
  add constraint communication_settings_customer_reminder_channel_check
    check (calendar_customer_reminder_channel in ('email', 'sms')),
  add constraint communication_settings_employee_reminder_channel_check
    check (calendar_employee_reminder_channel in ('email', 'sms')),
  add constraint communication_settings_installer_reminder_channel_check
    check (calendar_installer_reminder_channel in ('email', 'sms'));

commit;
