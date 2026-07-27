begin;

alter table public.employees
  add column if not exists default_calendar_view text not null default 'month',
  add column if not exists remember_last_calendar_view boolean not null default true,
  add column if not exists last_calendar_view text;

alter table public.employees
  drop constraint if exists employees_default_calendar_view_check,
  drop constraint if exists employees_last_calendar_view_check;

alter table public.employees
  add constraint employees_default_calendar_view_check
    check (default_calendar_view in ('month', 'week', 'three_day', 'day')),
  add constraint employees_last_calendar_view_check
    check (
      last_calendar_view is null
      or last_calendar_view in ('month', 'week', 'three_day', 'day')
    );

alter table public.installer_crews
  add column if not exists color text not null default '#047857';

alter table public.installer_crews
  drop constraint if exists installer_crews_color_check;

alter table public.installer_crews
  add constraint installer_crews_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.appointments
  drop constraint if exists appointments_appointment_type_check;

alter table public.appointments
  add constraint appointments_appointment_type_check
  check (
    appointment_type in (
      'appointment',
      'measure',
      'installation',
      'follow_up',
      'job_walk',
      'material_selection',
      'builder_meeting',
      'customer_meeting',
      'other'
    )
  );

commit;
