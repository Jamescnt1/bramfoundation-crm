-- Foundation CRM communication foundation rollback.
-- This removes only Phase 1 objects. Existing customer email and internal messaging remain intact.
-- Before destructive teardown, export any communication_* records that must be retained.

begin;

delete from public.role_permissions
where permission_key in ('communications.view', 'communications.send', 'communications.manage');

delete from public.permission_definitions
where key in ('communications.view', 'communications.send', 'communications.manage');

drop table if exists public.communication_webhook_events;
drop table if exists public.communication_deliveries;
drop table if exists public.communication_templates;
drop table if exists public.communication_consents;
drop table if exists public.employee_communication_preferences;
drop table if exists public.communication_settings;
drop function if exists public.set_communication_updated_at();

commit;
