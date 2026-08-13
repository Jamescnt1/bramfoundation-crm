begin;

drop trigger if exists appointments_queue_communication_automation on public.appointments;
drop function if exists public.queue_appointment_communication_automation();
drop table if exists public.communication_automation_events;

alter table public.automation_rules
  drop constraint if exists automation_rules_action_type_check,
  drop constraint if exists automation_rules_notification_audience_check,
  drop constraint if exists automation_rules_notification_channel_check,
  drop column if exists notification_audience,
  drop column if exists notification_channel;

alter table public.automation_rules
  add constraint automation_rules_action_type_check
    check (action_type in ('create_task', 'update_job_status', 'send_email'));

commit;
