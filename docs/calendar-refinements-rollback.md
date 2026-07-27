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

## View Options refactor

### Pre-change baseline

- Git commit: `d2f00f7`
- Commit label: `Refine calendar scheduling views and preferences`
- Recorded: July 26, 2026
- Database changes: none

This refactor replaces the persistent Appointments filter strip and view
selector with a responsive `View Options` dialog. It does not alter calendar
queries, appointment permission checks, appointment records, employee colors,
or install-schedule behavior.

### Files introduced or changed

- `app/calendar/page.tsx`
- `components/calendar/CalendarBoard.tsx`
- `components/calendar/CalendarToolbar.tsx`
- `components/calendar/CalendarViewOptions.tsx`
- `docs/calendar-refinements-rollback.md`

`components/calendar/CalendarFilters.tsx` is superseded by
`CalendarViewOptions.tsx` and may be restored if this refactor is rolled back.

### Preference storage

- Default view and remember-last-view continue to use the existing employee
  columns in Supabase.
- Applied employee, appointment-type, status, customer, and job filters are
  stored in browser local storage under a key scoped to the signed-in employee.
- Local filter storage never expands server-side visibility. The calendar can
  only filter the appointment records already returned by the authorized
  server query.

### Refactor rollback

1. Revert the application commit containing the View Options refactor.
2. Redeploy the reverted application.
3. No database rollback is required.
4. Stale browser preference keys may remain safely; the prior application does
   not read them. They may optionally be removed from browser site data.

### Refactor verification

- Appointments opens with all permitted employees and types visible by default.
- View Options opens, scrolls, applies, and resets on desktop.
- View Options behaves as a bottom sheet and remains scrollable in mobile
  Safari and iPad Safari.
- Applied filters survive navigation and reload for the same employee.
- Active filters produce a subtle toolbar count.
- Month, Week, 3 Day, Day, and List views remain usable.
- Default-view and remember-last-view preferences still persist per employee.
- Appointment creation, navigation, time positioning, employee colors,
  appointment-type icons, hover details, and tap details are unchanged.

### Refactor verification record

July 26, 2026:

- `npm run lint` completed with no errors. The two pre-existing
  `next/image` warnings remain in
  `components/attachments/AttachmentManager.tsx`.
- `npm run build` completed successfully, including TypeScript validation and
  production route generation.
- `git diff --check` completed successfully.
- The local application server responded and enforced the expected
  authentication redirect for `/calendar`.
- Automated in-app browser device checks could not reach the host-local
  development server from its isolated browser environment. Complete the
  desktop, iPad, and iPhone interaction items above in the signed-in beta
  environment before deployment sign-off.
