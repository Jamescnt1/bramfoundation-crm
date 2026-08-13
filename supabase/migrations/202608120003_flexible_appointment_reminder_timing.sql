begin;

alter table public.communication_settings
  drop constraint if exists communication_settings_reminder_hours_check;

alter table public.communication_settings
  add constraint communication_settings_reminder_hours_check
    check (appointment_reminder_hours_before between 1 and 720);

commit;
