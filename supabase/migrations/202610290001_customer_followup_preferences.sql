begin;

alter table public.customers
  add column if not exists lead_followups_enabled boolean not null default true,
  add column if not exists estimate_followups_enabled boolean not null default true;

comment on column public.customers.lead_followups_enabled is
  'Allows automated New Lead and untouched-lead follow-up tasks for this customer.';
comment on column public.customers.estimate_followups_enabled is
  'Allows automated Estimate Sent follow-up tasks for this customer.';

create or replace function public.respect_customer_followup_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_customer_id uuid;
  rule_event text;
  rule_value text;
  normalized_value text;
  allow_lead boolean := true;
  allow_estimate boolean := true;
begin
  if new.automation_rule_id is null then
    return new;
  end if;

  select trigger_event, trigger_value
  into rule_event, rule_value
  from public.automation_rules
  where id = new.automation_rule_id;

  normalized_value := lower(replace(coalesce(rule_value, ''), ' ', '_'));
  if rule_event <> 'lead_untouched_daily'
     and not (rule_event = 'job_status_changed' and normalized_value in ('new_lead', 'estimate_sent')) then
    return new;
  end if;

  target_customer_id := new.customer_id;
  if target_customer_id is null and new.job_id is not null then
    select customer_id into target_customer_id
    from public.jobs
    where id = new.job_id;
  end if;
  if target_customer_id is null then
    return new;
  end if;

  select lead_followups_enabled, estimate_followups_enabled
  into allow_lead, allow_estimate
  from public.customers
  where id = target_customer_id;

  if rule_event = 'lead_untouched_daily' and not coalesce(allow_lead, true) then
    return null;
  end if;
  if rule_event = 'job_status_changed' and normalized_value = 'new_lead'
     and not coalesce(allow_lead, true) then
    return null;
  end if;
  if rule_event = 'job_status_changed' and normalized_value = 'estimate_sent'
     and not coalesce(allow_estimate, true) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists job_tasks_00_respect_customer_followups on public.job_tasks;
create trigger job_tasks_00_respect_customer_followups
before insert on public.job_tasks
for each row execute function public.respect_customer_followup_preferences();

commit;
