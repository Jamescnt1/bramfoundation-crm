begin;

drop trigger if exists appointments_queue_communication_automation on public.appointments;

create or replace function public.queue_appointment_communication_automation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' then return new; end if;
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at
     or new.installer_crew_id is distinct from old.installer_crew_id
     or new.assigned_employee_id is distinct from old.assigned_employee_id then
    insert into public.communication_automation_events (
      trigger_event, trigger_value, job_id, appointment_id, event_fingerprint
    ) values (
      'appointment_scheduled', new.appointment_type, new.job_id, new.id,
      concat('appointment_scheduled:', new.id, ':', extract(epoch from new.starts_at)::bigint, ':',
        coalesce(new.assigned_employee_id::text, ''), ':', coalesce(new.installer_crew_id::text, ''))
    ) on conflict (event_fingerprint) do nothing;
  end if;
  return new;
end;
$$;

alter table public.appointments
  drop column if exists reminder_hours_before,
  drop column if exists preferred_communication_channel,
  drop column if exists reminder_notification_enabled,
  drop column if exists confirmation_notification_enabled,
  drop column if exists customer_notifications_enabled;

alter table public.jobs
  drop column if exists preferred_communication_channel,
  drop column if exists customer_communication_mode;

alter table public.customers
  drop column if exists preferred_communication_channel,
  drop column if exists automated_communications_enabled;

create trigger appointments_queue_communication_automation
after insert or update of starts_at, installer_crew_id, assigned_employee_id, status on public.appointments
for each row execute function public.queue_appointment_communication_automation();

commit;
