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

## Configurable appointment types and calendar density refinement

### Pre-change baseline

- Git commit: `803f80c90f158e6e5fe6137a87815833a00bb418`
- Commit label: `Add installation crew work order tracking`
- Recorded: July 30, 2026
- Unrelated pre-existing working-tree item: `supabase/.temp/`

This refinement replaces the frontend-only appointment-type list with an
administratively managed table, adds subtle weekend emphasis, aligns calendar
chrome with Foundation's neutral/blue palette, defaults new appointments to a
one-hour duration, and reduces desktop calendar page scrolling.

### Planned database change

Migration `202607300003_configurable_appointment_types.sql`:

- Creates `public.appointment_types` with a stable `key`, editable `name`,
  `active`, and `sort_order`.
- Seeds every appointment type supported by the application before adding the
  relationship.
- Replaces the fixed appointment-type check constraint with a foreign key from
  `appointments.appointment_type` to `appointment_types.key`.
- Preserves historical appointment labels by retiring referenced types instead
  of deleting them.
- Adds preparation, audit, indexes, RLS, and administrator policies consistent
  with the existing Administration configuration tables.

### Planned application areas

- Appointment-type Administration page and shared CRUD service/actions
- Settings hub scheduling navigation
- Unified appointment dialog used by Calendar and Job Workspace scheduling
- Calendar filter options, labels, and appointment icon fallback
- Month, week, 3-day, and day weekend presentation
- Desktop month and time-grid density
- Calendar page and Job Workspace appointment-type loading

### Safe rollback

1. Stop deployment or place the application in maintenance mode.
2. Revert the application commit containing this refinement and redeploy.
3. Keep `appointment_types` and its foreign key in place while the prior
   application is live. The seeded keys remain compatible with the prior
   frontend constants.
4. If a complete database rollback is required, first verify that no custom
   appointment-type keys are referenced:

```sql
select distinct a.appointment_type
from public.appointments a
left join (
  values
    ('appointment'),
    ('measure'),
    ('installation'),
    ('follow_up'),
    ('job_walk'),
    ('material_selection'),
    ('builder_meeting'),
    ('customer_meeting'),
    ('other')
) as supported(key) on supported.key = a.appointment_type
where supported.key is null;
```

5. If the query returns rows, export or remap those appointments before
   continuing. Removing the table without remapping custom keys would make the
   prior application unable to format those records.
6. After confirming only prior supported keys remain, run:

```sql
begin;

alter table public.appointments
  drop constraint if exists appointments_appointment_type_fkey;

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

drop table if exists public.appointment_types;

commit;
```

### Verification checklist

- Administrators can create, rename, reorder, retire, reactivate, and remove an
  unused appointment type.
- A referenced type is retired instead of deleted and historical appointments
  retain its label.
- Active types appear in every unified Schedule form entry point.
- Editing a historical appointment keeps its retired type selectable.
- Weekend shading is visible without making Saturday or Sunday look disabled.
- Month, Week, 3 Day, and Day retain readable employee colors.
- No calendar chrome uses green except an employee or crew configured with a
  green color.
- Changing a new appointment start time keeps the end time one hour later until
  the end time is manually edited.
- Manual end-time edits survive subsequent start-time and field changes.
- A routine desktop workday is visible inside the calendar without page-level
  scrolling; unusually early or late times remain available by internal scroll.
- Mobile and iPad dialogs remain scroll-safe.
- Hover cards, filters, employee colors, and Install Calendar behavior remain
  intact.

### Verification record

July 30, 2026:

- `npm run lint` completed with no errors. The two pre-existing `next/image`
  warnings remain in `components/attachments/AttachmentManager.tsx`.
- `npm run build` completed successfully, including TypeScript validation and
  route generation for `/settings/appointment-types`.
- `git diff --check` completed successfully.
- Source scan confirmed that the hard-coded `APPOINTMENT_TYPES` list has been
  removed from application code.
- Source scan confirmed no green or emerald calendar chrome remains. The color
  contrast calculation still refers to the RGB green channel, which is
  mathematical logic rather than a UI color.
- Database-backed CRUD and signed-in browser interaction checks require
  `202607300003_configurable_appointment_types.sql` to be applied to the
  connected Supabase project. Complete the checklist above in the deployed beta
  environment before production sign-off.

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
