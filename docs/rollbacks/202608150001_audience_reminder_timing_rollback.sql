begin;

update public.communication_settings
set appointment_reminder_hours_before = calendar_customer_reminder_hours_before;

alter table public.communication_settings
  drop column if exists calendar_customer_reminder_hours_before,
  drop column if exists calendar_employee_reminder_hours_before,
  drop column if exists calendar_installer_reminder_hours_before;

commit;
