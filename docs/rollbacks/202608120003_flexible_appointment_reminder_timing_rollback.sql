begin;

update public.communication_settings
set appointment_reminder_hours_before = least(appointment_reminder_hours_before, 168);

alter table public.communication_settings
  drop constraint if exists communication_settings_reminder_hours_check;

alter table public.communication_settings
  add constraint communication_settings_reminder_hours_check
    check (appointment_reminder_hours_before between 1 and 168);

commit;
