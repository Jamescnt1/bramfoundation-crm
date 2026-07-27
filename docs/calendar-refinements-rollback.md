# Calendar Refinements: Implementation and Rollback

## Purpose

This document records the stable baseline and rollback procedure for the
employee-color calendar, time-grid schedule views, appointment hover details,
and employee calendar preferences.

## Stable baseline

- Git commit: `6d5f027cefd2a3fdcc8cc60dfd8ab8aee4d78f99`
- Commit label: `Unify appointment scheduling workflow`
- Recorded: July 26, 2026
- Unrelated pre-existing working-tree item: `supabase/.temp/`

The Supabase temporary directory is not part of this feature and must not be
added, removed, or restored as part of a calendar rollback.

## Database changes introduced by this feature

Migration `202607270002_calendar_refinements.sql` adds:

- `employees.default_calendar_view`
- `employees.remember_last_calendar_view`
- `employees.last_calendar_view`
- `installer_crews.color`
- `customer_meeting` as an allowed appointment type

All new employee preference columns have defaults. Existing employee calendar
colors remain the source of truth for appointment colors.

## Application areas changed

- Calendar appointment data shape and server-side query
- Month appointment badges
- Week, 3-day, and day time-grid views
- Appointment hover/focus/mobile details
- Calendar employee and appointment-type filters
- Employee calendar settings
- Installer-crew color administration and install schedule bars
- Appointment type labels and icons

## Safe rollback

1. Stop the application deployment or place it in maintenance mode.
2. Revert the application commit containing the calendar refinements.
3. Redeploy the reverted application.
4. The added database columns may safely remain in place; the prior
   application does not read them.
5. If a complete database rollback is required, run the SQL below only after
   the prior application version is live:

```sql
begin;

update public.appointments
set appointment_type = 'appointment'
where appointment_type = 'customer_meeting';

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
      'other'
    )
  );

alter table public.employees
  drop column if exists default_calendar_view,
  drop column if exists remember_last_calendar_view,
  drop column if exists last_calendar_view;

alter table public.installer_crews
  drop column if exists color;

commit;
```

The `customer_meeting` conversion is intentionally destructive. Export any
affected appointment records before running the complete database rollback.

## Verification checklist

- Month, week, 3-day, and day views render.
- Employee filters show all or selected employees.
- Appointment-type filters work.
- Time-grid appointments align with start/end times.
- Overlapping appointments render in separate columns.
- Early-morning and evening appointments remain reachable.
- Hover and keyboard focus expose complete appointment details.
- Tapping an appointment on iPhone/iPad opens the existing details panel.
- Employee colors maintain readable text contrast.
- Default and remembered calendar views behave as configured.
- Install schedule retains the `+ Install` entry point and crew colors.

## Verification record

July 26, 2026:

- `npm run lint` completed with no errors. Two pre-existing `next/image`
  warnings remain in `components/attachments/AttachmentManager.tsx`.
- `npm run build` completed successfully, including TypeScript validation and
  production route generation.
- `git diff --check` completed successfully.

Interactive browser and device checks require
`202607270002_calendar_refinements.sql` to be applied to the connected
Supabase project first. Complete the checklist above in the deployed beta
environment after the migration is applied.
