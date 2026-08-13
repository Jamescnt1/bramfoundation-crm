begin;

alter table public.customers
  add column if not exists automated_communications_enabled boolean not null default false,
  add column if not exists preferred_communication_channel text not null default 'none';

alter table public.customers
  drop constraint if exists customers_preferred_communication_channel_check;

alter table public.customers
  add constraint customers_preferred_communication_channel_check
    check (preferred_communication_channel in ('none', 'email', 'sms', 'both'));

alter table public.jobs
  add column if not exists customer_communication_mode text not null default 'off',
  add column if not exists preferred_communication_channel text not null default 'inherit';

alter table public.jobs
  drop constraint if exists jobs_customer_communication_mode_check,
  drop constraint if exists jobs_preferred_communication_channel_check;

alter table public.jobs
  add constraint jobs_customer_communication_mode_check
    check (customer_communication_mode in ('off', 'inherit', 'on')),
  add constraint jobs_preferred_communication_channel_check
    check (preferred_communication_channel in ('inherit', 'email', 'sms', 'both'));

alter table public.appointments
  add column if not exists customer_notifications_enabled boolean not null default false,
  add column if not exists confirmation_notification_enabled boolean not null default false,
  add column if not exists reminder_notification_enabled boolean not null default false,
  add column if not exists preferred_communication_channel text not null default 'inherit',
  add column if not exists reminder_hours_before integer;

alter table public.appointments
  drop constraint if exists appointments_preferred_communication_channel_check,
  drop constraint if exists appointments_reminder_hours_before_check;

alter table public.appointments
  add constraint appointments_preferred_communication_channel_check
    check (preferred_communication_channel in ('inherit', 'email', 'sms', 'both')),
  add constraint appointments_reminder_hours_before_check
    check (reminder_hours_before is null or reminder_hours_before between 1 and 720);

create or replace function public.queue_appointment_communication_automation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' then return new; end if;
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
     or new.installer_crew_id is distinct from old.installer_crew_id
     or new.assigned_employee_id is distinct from old.assigned_employee_id
     or new.customer_notifications_enabled is distinct from old.customer_notifications_enabled
     or new.confirmation_notification_enabled is distinct from old.confirmation_notification_enabled
     or new.preferred_communication_channel is distinct from old.preferred_communication_channel then
    insert into public.communication_automation_events (
      trigger_event, trigger_value, job_id, appointment_id, event_fingerprint
    ) values (
      'appointment_scheduled', new.appointment_type, new.job_id, new.id,
      concat('appointment_scheduled:', new.id, ':', extract(epoch from new.starts_at)::bigint, ':',
        coalesce(new.assigned_employee_id::text, ''), ':', coalesce(new.installer_crew_id::text, ''), ':',
        new.customer_notifications_enabled::text, ':', new.confirmation_notification_enabled::text, ':',
        new.preferred_communication_channel)
    ) on conflict (event_fingerprint) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_queue_communication_automation on public.appointments;
create trigger appointments_queue_communication_automation
after insert or update of starts_at, installer_crew_id, assigned_employee_id, status,
  customer_notifications_enabled, confirmation_notification_enabled, preferred_communication_channel
on public.appointments
for each row execute function public.queue_appointment_communication_automation();

commit;
