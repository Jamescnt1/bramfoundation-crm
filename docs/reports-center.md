# Foundation Reports Center

## Purpose

The Reports Center organizes Foundation's current operational data around
manager questions. The library stays compact: categories reveal concise report
cards, and only the selected report fetches data.

## Included reports

- Executive Overview
- Sales Performance
- Operations Health
- Employee Scorecards
- Customer Value
- Pipeline Funnel
- Pipeline Velocity
- Task Performance
- Calendar Activity
- Operational Dollars
- File & Layout Coverage
- Internal Communications

Unsupported metrics are labeled instead of inferred. Examples include historical
time in each pipeline stage, message response time, reschedule counts, and
commercial-versus-residential classification.

## Architecture

- `lib/reports/definitions.ts` is the report catalog.
- `lib/reports/types.ts` defines shared inputs and result shapes.
- `lib/reports/date-range.ts` owns presets and date validation.
- `lib/reports/engine.ts` runs only the active report.
- `lib/services/reports.ts` provides authorization, filters, and favorites.
- `app/api/reports/route.ts` is the authenticated lazy-loading endpoint.
- `components/reports/*` provides the shared center, toolbar, chart, table,
  export, and print interface.

Reports require the existing `reports.view` permission. Database RLS remains the
final data-access boundary.

## Supabase execution

Run exactly one migration in Supabase SQL Editor:

1. Open `supabase/migrations/202607280001_reports_center.sql`.
2. Copy the complete file into a new SQL Editor query.
3. Select **Run**.
4. Confirm `Success. No rows returned`.
5. In Table Editor, confirm `report_favorites` exists.

The migration is transactional and safe to rerun.

## Environment variables

No new environment variables are required.

## Verification

1. Sign in as an employee with `reports.view`.
2. Open `/reports`.
3. Open each category and run its report for This Month.
4. Change to a custom range and verify the result label.
5. Apply employee and pipeline-stage filters where offered.
6. Favorite a report, reload, and confirm it remains in Favorite Reports.
7. Export CSV and open the file.
8. Print or save the report as PDF.
9. Compare Operational Dollars with the former report using an all-time range.
10. Check the page at desktop, iPad, and phone widths.

## Deployment checklist

1. Run the Supabase migration before deploying the application.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Commit and push.
5. Confirm the Vercel deployment uses the existing Supabase environment values.
6. Open `/reports` in production and run Operational Dollars first.
7. Verify favorites persist after a production reload.
8. Smoke-test Dashboard, Pipeline, Tasks, Calendar, Customers, and Search.

