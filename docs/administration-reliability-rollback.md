# Administration reliability and recipients rollback

## Scope

This change repairs Automation Rule persistence and Task Types loading, adds
multi-recipient automation assignments, and allows administrators to edit role
metadata and status.

## Before deployment

1. Record the current application commit.
2. Back up these tables:
   - `automation_rules`
   - `role_definitions`
   - `role_permissions`
   - `task_types`
3. Apply `supabase/migrations/202607270005_administration_reliability.sql`.
4. Deploy the application only after the migration succeeds.

## Roll back application code

Revert the application commit containing this document and redeploy. Existing
automation rules remain compatible because the original assignment columns are
preserved.

## Roll back database additions

Only run this after the application rollback:

```sql
begin;

drop table if exists public.automation_rule_recipients;

drop index if exists public.job_tasks_automation_rule_transition_recipient_idx;

create unique index if not exists job_tasks_automation_rule_transition_idx
  on public.job_tasks(automation_transition_id, automation_rule_id)
  where automation_transition_id is not null
    and automation_rule_id is not null;

commit;
```

The migration replaces `run_crm_automations`. Restore that function from
`supabase/migrations/202607200006_crm_wide_automations.sql` if the entire
multi-recipient feature must be removed.

## Verification after rollback

- Open Settings → Automation Rules.
- Create and edit a single-recipient rule.
- Open Settings → Task Types and verify list/create/edit/retire.
- Open Settings → Roles & Permissions and verify permission assignments.
