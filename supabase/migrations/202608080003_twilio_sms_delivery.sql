begin;

alter table public.communication_deliveries
  add column if not exists provider_status text,
  add column if not exists provider_error_code text;

create index if not exists communication_deliveries_sms_status_idx
  on public.communication_deliveries(status, created_at desc)
  where channel = 'sms';

create index if not exists communication_consents_phone_status_idx
  on public.communication_consents(phone_number, status);

insert into public.communication_templates (
  name, category, channel, audience, body, active
)
values (
  'Installer Connection Test',
  'System',
  'sms',
  'installer',
  'Foundation CRM test: Installer scheduling text messages are connected. Reply STOP to unsubscribe.',
  true
)
on conflict do nothing;

commit;
