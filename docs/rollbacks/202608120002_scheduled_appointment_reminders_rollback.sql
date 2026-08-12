begin;

alter table public.communication_settings
  drop constraint if exists communication_settings_reminder_hours_check,
  drop constraint if exists communication_settings_customer_reminder_channel_check,
  drop constraint if exists communication_settings_employee_reminder_channel_check,
  drop constraint if exists communication_settings_installer_reminder_channel_check,
  drop column if exists appointment_reminder_hours_before,
  drop column if exists calendar_customer_reminder_channel,
  drop column if exists calendar_employee_reminder_channel,
  drop column if exists calendar_installer_reminder_channel;

commit;
