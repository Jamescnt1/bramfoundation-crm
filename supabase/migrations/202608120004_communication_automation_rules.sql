begin;

alter table public.automation_rules
  add column if not exists notification_audience text,
  add column if not exists notification_channel text;

alter table public.automation_rules
  drop constraint if exists automation_rules_action_type_check,
  drop constraint if exists automation_rules_notification_audience_check,
  drop constraint if exists automation_rules_notification_channel_check;

alter table public.automation_rules
  add constraint automation_rules_action_type_check
    check (action_type in ('create_task', 'update_job_status', 'send_email', 'send_notification')),
  add constraint automation_rules_notification_audience_check
    check (notification_audience is null or notification_audience in ('customer', 'employee', 'installer')),
  add constraint automation_rules_notification_channel_check
    check (notification_channel is null or notification_channel in ('email', 'sms'));

create table if not exists public.communication_automation_events (
  id uuid primary key default gen_random_uuid(),
  trigger_event text not null,
  trigger_value text,
  job_id uuid references public.jobs(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  event_fingerprint text not null unique,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists communication_automation_events_pending_idx
  on public.communication_automation_events(created_at)
  where processed_at is null;

alter table public.communication_automation_events enable row level security;

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

drop trigger if exists appointments_queue_communication_automation on public.appointments;
create trigger appointments_queue_communication_automation
after insert or update of starts_at, installer_crew_id, assigned_employee_id, status on public.appointments
for each row execute function public.queue_appointment_communication_automation();

commit;
