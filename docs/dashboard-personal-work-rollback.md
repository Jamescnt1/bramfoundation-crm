# Dashboard Personal Work and Appointment Time Fix

Status: Implemented
Date: 2026-07-31

## Purpose

This change makes the personal dashboard task panel show all open tasks assigned
to the signed-in employee, adds an in-row task-status control, and makes
dashboard appointment dates and times use the company timezone consistently.

The company dashboard and the company-wide Tasks page remain unchanged.

## Pre-change baseline

- Record the implementation commit after verification.
- Unrelated pre-existing working-tree item: `supabase/.temp/`
- No database migration is required for this change.

## Planned application areas

- Personal employee workspace query and task-note loading
- Personal dashboard task panel
- Authenticated task-status Server Action
- Shared appointment date/time formatting
- Dashboard appointment links and displayed times

## Safe application rollback

1. Revert the application commit containing this change.
2. Redeploy the previous stable application version.
3. Do not alter Supabase tables or policies; this change adds no schema objects.
4. Task-status changes made while the feature was live are normal business data
   and should remain unless management intentionally changes them back.

## Partial rollback

- To remove only quick status updates, remove the dashboard status action and
  restore the previous read-only task rows.
- To restore the eight-task limit, restore the previous `slice(0, 8)` rendering.
- Do not restore server-local appointment formatting. Keep explicit company
  timezone formatting unless the entire timezone fix is intentionally reverted.

## Verification after rollback

- `/my-dashboard` loads.
- The main `/tasks` page still shows company tasks according to permissions.
- Existing tasks and task notes remain intact.
- Calendar and Job Workspace appointments still load.
- Company dashboard management widgets remain unchanged.

## Data safety notes

- The status action accepts only a task ID and validated status.
- The server re-checks the signed-in employee and task assignment before update.
- Completed and cancelled tasks are omitted from the personal dashboard by
  default but are not deleted.
- The update relies on existing task status columns, triggers, and RLS policies.

## Verification record

July 31, 2026:

- `npm run lint` completed with no errors. Two pre-existing `next/image`
  warnings remain in `components/attachments/AttachmentManager.tsx`.
- `npm run build` completed successfully, including TypeScript validation and
  production route generation.
- `npx tsc --noEmit --pretty false` completed successfully.
- `git diff --check` completed successfully.
- Explicit `America/Phoenix` checks passed for morning, afternoon, evening,
  cross-date, January, June, July, and December timestamps.
- January and July both resolved to UTC-7, confirming Arizona does not receive
  a daylight-saving adjustment.

The local preview server started, but the in-app preview could not attach in
this environment. Complete the signed-in desktop, iPad, and phone checks in the
deployed beta environment before production promotion. Include one successful
quick status update and one permissions-denied test using a task assigned to a
different employee.
