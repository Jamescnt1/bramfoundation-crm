# Company Dashboard Rules

## Purpose

This change preserves the existing Company Dashboard layout while making the
contents of **Needs Attention** and **Needs My Attention** configurable.

Administrators manage company defaults at:

`/settings/company-dashboard`

The implementation adds:

- A registry of supported dashboard rules in `lib/dashboard-rules.ts`
- Company default rule settings stored in `dashboard_rule_settings`
- Optional employee-specific override rows for future use
- A settings service, server action, and Administration UI
- Rule-aware dashboard evaluation and severity ordering

## Database change

Migration:

`supabase/migrations/202607270003_company_dashboard_rules.sql`

The migration creates `public.dashboard_rule_settings`. A row with
`employee_id is null` is a company default. A row with an employee ID is a
future personal override. The initial UI edits company defaults only.

Rules are identified by stable `rule_key` values. Display labels and
descriptions live in the application registry so adding explanatory copy does
not require a data migration.

## Adding a rule

1. Add the rule definition to `lib/dashboard-rules.ts`.
2. Add its evaluator to `lib/services/company-dashboard.ts`.
3. If it needs additional data, load that data only when the rule is enabled.
4. Add a company-default seed row to a new migration.
5. Document the rule in this file or `docs/Features.md`.

Do not rename a shipped `rule_key`. Add a replacement rule and migrate saved
settings if a semantic change is required.

## Enable, disable, and prioritize

Administrators can:

- Enable or disable each rule independently.
- Assign `critical`, `important`, or `informational` severity.
- Set the inactivity-day threshold for the no-activity rule.

Dashboard items are ordered:

1. Critical
2. Important
3. Informational

Only enabled rules are evaluated. Optional layout, attachment, and mention
queries are skipped unless their corresponding rules are enabled.

## Rollback

Before rollback, export `public.dashboard_rule_settings` if the saved
configuration may be needed later.

Application rollback:

1. Revert the commit that introduced the Company Dashboard rules feature.
2. Redeploy the previous stable application version.
3. Confirm `/company` again uses the former hard-coded attention logic.

Database rollback is optional because the added table is isolated and older
application versions do not reference it. To remove it permanently:

```sql
drop table if exists public.dashboard_rule_settings;
```

Removing the table deletes all saved company defaults and future employee
overrides. This does not delete jobs, tasks, appointments, messages, layouts,
files, photos, employees, or dashboard source data.

## Verification

After deployment:

1. Open Administration → Company Dashboard as an administrator.
2. Disable Missing Job Address and save.
3. Confirm address-only exceptions no longer appear on Company Dashboard.
4. Enable the rule and confirm it returns.
5. Change a rule’s severity and confirm its position changes.
6. Change the no-activity threshold and confirm the description and results
   use the saved number of days.
7. Confirm non-administrators cannot update company defaults.
