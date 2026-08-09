-- Foundation CRM Phase 3 rollback.
-- Disable Text Messages in Settings before applying this rollback.
-- Existing delivery and webhook history is preserved; only Phase 3 additions are removed.

begin;

delete from public.communication_templates
where name = 'Installer Connection Test'
  and category = 'System'
  and channel = 'sms'
  and audience = 'installer';

drop index if exists public.communication_deliveries_sms_status_idx;
drop index if exists public.communication_consents_phone_status_idx;

alter table public.communication_deliveries
  drop column if exists provider_status,
  drop column if exists provider_error_code;

commit;
