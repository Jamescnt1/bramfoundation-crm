# Reports Center rollout and rollback

## Baseline

Before this change, `/reports` rendered one server page backed by
`getSalesPipelineReport()` in `lib/services/reports.ts`.

That report defined:

- Sold jobs as jobs currently in Approved or any later active stage except Lost.
- Completed installs as jobs currently in the `complete` stage.
- Billed jobs as jobs with `billed_at` populated.
- Dollar values as the sum of positive `contract_amount` values.
- Pipeline rows as active stages from Approved forward, excluding Lost.

Those definitions remain the compatibility contract for the Operational Dollars
report. The Reports Center adds a date cohort around them but does not alter the
stage, billed, or contract-amount rules.

## Database change

Migration: `supabase/migrations/202607280001_reports_center.sql`

It adds:

- `report_favorites`, an employee-owned list of report IDs.
- Date/filter indexes used by active reports.
- RLS policies that restrict favorites to the signed-in employee.

It does not change jobs, pipeline stages, calculations, or existing permissions.

## Rollback

1. Revert the application commit and redeploy.
2. The old `/reports` page will work even if `report_favorites` remains in the
   database.
3. If a complete database rollback is required, run:

```sql
begin;

drop table if exists public.report_favorites;

drop index if exists public.jobs_reports_created_idx;
drop index if exists public.jobs_reports_updated_idx;
drop index if exists public.job_activities_reports_created_idx;
drop index if exists public.job_tasks_reports_created_idx;
drop index if exists public.job_tasks_reports_completed_idx;
drop index if exists public.appointments_reports_starts_idx;
drop index if exists public.appointments_reports_employee_idx;
drop index if exists public.job_attachments_reports_created_idx;
drop index if exists public.job_layouts_reports_created_idx;
drop index if exists public.messages_reports_created_idx;

commit;
```

Dropping the indexes can temporarily slow reporting but does not remove business
data. Dropping `report_favorites` removes only saved report shortcuts.

## Operational Dollars date behavior

The compatibility calculations still evaluate each job exactly as before.
When a date range is active, the report uses the job's `updated_at` timestamp as
the cohort date because the current schema does not store a complete,
authoritative pipeline-stage transition ledger. Billed totals additionally use
`billed_at`, as they did before. This limitation is displayed in the report and
prevents the UI from implying historical stage snapshots that the database does
not currently contain.

