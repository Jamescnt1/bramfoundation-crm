# Unified Scheduling Refactor and Rollback

## Purpose

Foundation CRM uses one appointment form and one appointment service for Job
Workspace, Calendar, Install Schedule, and pipeline scheduling.

Entry-point wording and defaults:

- Job Workspace: **Schedule**; current customer, job, contacts, and job address.
- Appointments Calendar: **Appointment**; no customer or job selected.
- Install Schedule: **Install**; appointment type defaults to Install.
- Pipeline requirement: opens the Job Workspace scheduler with Install selected.

## Appointment type storage

The scheduling form uses these stored values:

| Stored value | Display label |
| --- | --- |
| `measure` | Floor Measure |
| `installation` | Install |
| `job_walk` | Job Walk |
| `material_selection` | Material Selection |
| `builder_meeting` | Builder Meeting |
| `appointment` | Customer Meeting |
| `follow_up` | Follow-up |
| `other` | Other |

The `appointment` value remains in use as the customer-meeting value so existing
general appointments remain compatible.

## Files changed

- `components/calendar/constants.ts`
- `components/calendar/AppointmentDialog.tsx`
- `components/calendar/CalendarBoard.tsx`
- `components/calendar/CalendarFilters.tsx`
- `components/calendar/CalendarToolbar.tsx`
- `components/calendar/InstallScheduleView.tsx`
- `components/jobs/JobWorkspace.tsx`
- `components/pipeline/JobRequirementsDialog.tsx`
- `components/pipeline/PipelineBoard.tsx`
- `components/settings/AutomationRuleDialog.tsx`
- `lib/appointment-display.ts`
- `supabase/migrations/202607270001_unified_scheduling_types.sql`

## Validation checklist

- Job Workspace Schedule opens with its job selected and job address active.
- Company Contact and Job Site Contact are visible when present.
- Calendar Appointment opens without a selected customer/job.
- Install Schedule Install opens with Install selected.
- Pipeline Install Scheduled requirement opens Install scheduling for that job.
- Material Selection prefers Custom Address.
- Floor Measure and Install prefer Job Address.
- Existing edit, completion, cancellation, deletion, time-range, and install-date
  validation still works.
- The form scrolls and its footer remains reachable in mobile Safari.

## Rollback

1. Revert the application files listed above.
2. Existing appointments using `material_selection` or `builder_meeting` must be
   changed before restoring the old database constraint:

   ```sql
   update public.appointments
   set appointment_type = 'other'
   where appointment_type in ('material_selection', 'builder_meeting');
   ```

3. Restore the previous database constraint:

   ```sql
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
         'other'
       )
     );
   ```

4. Run lint and a production build, then test the three scheduling entry points.

No appointment records, contacts, jobs, or addresses need to be deleted during
rollback.
