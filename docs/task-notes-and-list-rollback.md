# Task Notes and Scalable Task List

Status: Implemented
Date: 2026-07-27

## Purpose

This change adds a visible task-status pill, compact task-note previews, a
timestamped task-note history, task filters, priority-aware sorting, and
incremental list rendering.

The existing `job_tasks.description` column is retained for compatibility.
Existing non-empty descriptions are copied into `task_notes` as the first
historical note. New notes are stored only in `task_notes`.

## Files Added

- `supabase/migrations/202607270004_task_notes_and_list.sql`
- `lib/services/task-notes.ts`
- `app/actions/task-notes.ts`
- `components/tasks/TaskNotesPanel.tsx`
- `components/tasks/TaskViewOptions.tsx`

## Files Modified

- `components/tasks/types.ts`
- `lib/services/tasks.ts`
- `app/tasks/page.tsx`
- `components/tasks/TaskManager.tsx`
- `components/tasks/TaskDialog.tsx`
- `docs/Database.md`
- `docs/Features.md`
- `docs/ChangeLog.md`

## Database Changes

The migration creates `public.task_notes` with:

- Task relationship
- Author employee relationship
- Note body
- Created and updated timestamps
- Soft-deletion metadata

The migration also:

- Copies each existing non-empty `job_tasks.description` into one task note.
- Adds indexes for task/date lookup and active-note lookup.
- Enables row-level security.
- Adds a trigger that maintains `updated_at`.

The old `job_tasks.description` values are not removed or overwritten.

## Task View Options

Search, assignee, status, priority, category, and due-date controls are
contained in a compact View Options dialog opened beside New Task. The dialog
uses a bottom sheet on phones and a centered dialog on larger screens. Removing
`TaskViewOptions.tsx` and restoring the previous inline controls in
`TaskManager.tsx` rolls back this UI without changing task data.

## Application Rollback

1. Revert the application commit that introduced this feature.
2. Redeploy the previous stable application version.
3. Leave `task_notes` in place if preserving beta note history is preferred.
   The previous application will ignore the table.

This is the safest rollback because it restores the previous UI without
destroying notes created during testing.

## Full Database Rollback

Only run the following after exporting any task notes that must be retained:

```sql
begin;

drop view if exists public.task_latest_notes;
drop table if exists public.task_notes;

commit;
```

The original `job_tasks.description` column and its pre-migration content
remain available. Notes created after this feature is deployed do not get
copied back into `job_tasks.description`, so dropping `task_notes` permanently
deletes those newer notes.

## Verification After Rollback

- `/tasks` loads with the previous task-list interface.
- Existing tasks still show their original description values.
- Creating and editing tasks still works.
- Job Workspace task lists still load.
- Employee dashboards still load assigned tasks.
- Task automation continues to create tasks.

## Data Safety Notes

- Task-note deletion is soft deletion.
- The migration is additive and does not drop task columns.
- Note add/edit/delete actions are recorded in the existing audit architecture.
- Do not drop `task_notes` until the rollback decision is final.
