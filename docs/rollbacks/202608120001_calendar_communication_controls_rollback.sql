begin;

alter table public.communication_settings
  drop column if exists calendar_customer_notifications_enabled,
  drop column if exists calendar_employee_notifications_enabled,
  drop column if exists calendar_installer_notifications_enabled;

commit;
