begin;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  subject text not null check (char_length(trim(subject)) between 1 and 250),
  body text not null check (char_length(trim(body)) between 1 and 50000),
  active boolean not null default true,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists email_templates_name_unique_idx on public.email_templates(lower(name));

create table if not exists public.customer_emails (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  sent_by_employee_id uuid references public.employees(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender text not null,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'delivered', 'failed')),
  is_automated boolean not null default false,
  provider text,
  provider_message_id text,
  failure_reason text,
  automation_rule_id uuid references public.automation_rules(id) on delete set null,
  automation_transition_id uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_emails_job_created_idx on public.customer_emails(job_id, created_at desc);
create unique index if not exists customer_emails_provider_id_idx on public.customer_emails(provider, provider_message_id) where provider_message_id is not null;
create unique index if not exists customer_emails_automation_dedupe_idx
  on public.customer_emails(automation_rule_id, automation_transition_id)
  where automation_rule_id is not null and automation_transition_id is not null;

create table if not exists public.customer_email_attachments (
  email_id uuid not null references public.customer_emails(id) on delete cascade,
  attachment_id uuid not null references public.job_attachments(id) on delete restrict,
  primary key (email_id, attachment_id)
);

create table if not exists public.email_webhook_events (
  webhook_id text primary key,
  event_type text not null,
  provider_message_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.automation_rules add column if not exists email_template_id uuid references public.email_templates(id) on delete restrict;
alter table public.automation_rules drop constraint if exists automation_rules_action_type_check;
alter table public.automation_rules add constraint automation_rules_action_type_check
  check (action_type in ('create_task', 'update_job_status', 'send_email'));

insert into public.permission_definitions (key, name, description, category) values
('customer_email.view','View customer email','View customer email history on authorized jobs.','Communications'),
('customer_email.send','Send customer email','Send manual and template emails from authorized jobs.','Communications'),
('email_templates.manage','Manage email templates','Create, edit, test, enable, and disable email templates.','Administration')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (role_key, permission_key) values
('administrator','customer_email.view'),('administrator','customer_email.send'),('administrator','email_templates.manage'),
('sales_manager','customer_email.view'),('sales_manager','customer_email.send'),
('salesperson','customer_email.view'),('salesperson','customer_email.send'),
('operations_manager','customer_email.view'),('operations_manager','customer_email.send'),
('office_staff','customer_email.view'),('office_staff','customer_email.send')
on conflict do nothing;

alter table public.email_templates enable row level security;
alter table public.customer_emails enable row level security;
alter table public.customer_email_attachments enable row level security;
alter table public.email_webhook_events enable row level security;

create policy "Employees can view active email templates" on public.email_templates
for select to authenticated using (active or public.current_employee_id() is not null);
create policy "Employees can view authorized customer emails" on public.customer_emails
for select to authenticated using (public.employee_can_access_job(job_id));
create policy "Employees can view authorized customer email attachments" on public.customer_email_attachments
for select to authenticated using (
  exists (select 1 from public.customer_emails email where email.id = email_id and public.employee_can_access_job(email.job_id))
);

insert into public.email_templates (name, category, subject, body)
values
('New Lead Confirmation','Sales','We received your flooring request','Hi {{customer_name}},\n\nThank you for contacting {{company_name}} about {{job_name}}. We have received your request and a team member will follow up soon.\n\n{{company_phone}}'),
('Floor Measure Confirmation','Scheduling','Your floor measure is confirmed','Hi {{customer_name}},\n\nYour floor measure for {{job_name}} is scheduled for {{appointment_date}} at {{appointment_time}}. {{assigned_employee}} will be assisting you.\n\n{{company_name}}'),
('Measure Reminder','Scheduling','Reminder: floor measure for {{job_name}}','Hi {{customer_name}},\n\nThis is a reminder about your floor measure on {{appointment_date}} at {{appointment_time}}.\n\n{{company_name}}'),
('Estimate Follow-up','Sales','Following up on {{job_name}}','Hi {{customer_name}},\n\nWe are following up on the estimate for {{job_name}} (QF# {{qf_number}}). Please let us know if you have any questions.\n\n{{assigned_employee}}'),
('Approval Thank You','Sales','Thank you for approving {{job_name}}','Hi {{customer_name}},\n\nThank you for approving {{job_name}}. We appreciate the opportunity and will keep you updated as the project moves forward.\n\n{{company_name}}'),
('Installation Preparation Checklist','Installation','Installation preparation checklist for {{job_name}}','Hi {{customer_name}},\n\nYour installation is scheduled for {{appointment_date}} at {{appointment_time}}. Please clear small items and valuables from the work area, confirm appliance arrangements, and ensure our crew can access the property.\n\nJob: {{job_name}}\nQF#: {{qf_number}}\n\nQuestions? Call {{company_phone}}.'),
('Installation Reminder','Installation','Reminder: installation for {{job_name}}','Hi {{customer_name}},\n\nThis is a reminder that installation for {{job_name}} is scheduled for {{appointment_date}} at {{appointment_time}}.\n\n{{company_name}}'),
('Completion Thank You','Customer Care','Thank you from {{company_name}}','Hi {{customer_name}},\n\nThank you for trusting us with {{job_name}}. We hope you enjoy your completed flooring project.\n\n{{company_name}}'),
('Review Request','Customer Care','Would you share your experience?','Hi {{customer_name}},\n\nThank you for choosing {{company_name}} for {{job_name}}. We would appreciate your feedback and a review of your experience.\n\nThank you!')
on conflict do nothing;

create or replace function public.render_email_merge_fields(source text, target_job_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare result text := source; job_row public.jobs%rowtype; customer_name text; company_name text; company_phone text;
  employee_name text; appointment_date text; appointment_time text;
begin
  select * into job_row from public.jobs where id = target_job_id;
  select coalesce(customer.full_name, job_row.customer_name) into customer_name from public.customers customer where customer.id = job_row.customer_id;
  customer_name := coalesce(customer_name, job_row.customer_name, 'Customer');
  select settings.company_name, settings.phone into company_name, company_phone from public.company_settings settings where singleton_key = true limit 1;
  select employee.name into employee_name from public.employees employee where employee.id = job_row.assigned_employee_id;
  select to_char(appointment.starts_at at time zone coalesce((select timezone from public.company_settings where singleton_key = true limit 1),'America/Phoenix'), 'FMMonth FMDD, YYYY'),
         to_char(appointment.starts_at at time zone coalesce((select timezone from public.company_settings where singleton_key = true limit 1),'America/Phoenix'), 'FMHH12:MI AM')
    into appointment_date, appointment_time
  from public.appointments appointment where appointment.job_id = target_job_id and appointment.starts_at >= now()
  order by appointment.starts_at limit 1;
  result := replace(result, '{{customer_name}}', coalesce(customer_name,''));
  result := replace(result, '{{job_name}}', coalesce(job_row.customer_name,''));
  result := replace(result, '{{qf_number}}', coalesce(job_row.qfloors_job_number,''));
  result := replace(result, '{{appointment_date}}', coalesce(appointment_date,'To be scheduled'));
  result := replace(result, '{{appointment_time}}', coalesce(appointment_time,''));
  result := replace(result, '{{assigned_employee}}', coalesce(employee_name,job_row.salesperson,'Your Bram Flooring team'));
  result := replace(result, '{{company_name}}', coalesce(company_name,'Bram Flooring'));
  result := replace(result, '{{company_phone}}', coalesce(company_phone,''));
  return result;
end $$;

create or replace function public.queue_job_status_emails()
returns trigger language plpgsql security definer set search_path = public as $$
declare rule public.automation_rules%rowtype; template public.email_templates%rowtype; transition_id uuid := gen_random_uuid();
  recipient_email text; customer_name text; company_email text; queued_subject text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select coalesce(customer.email, new.email), coalesce(customer.full_name, new.customer_name)
    into recipient_email, customer_name from public.customers customer where customer.id = new.customer_id;
  recipient_email := coalesce(recipient_email, new.email);
  if recipient_email is null then return new; end if;
  select email into company_email from public.company_settings where singleton_key = true limit 1;
  for rule in select * from public.automation_rules
    where trigger_event = 'job_status_changed' and (trigger_value is null or trigger_value = new.status)
      and action_type = 'send_email' and active = true and email_template_id is not null
    order by sort_order, created_at, id
  loop
    select * into template from public.email_templates where id = rule.email_template_id and active = true;
    if found then
      queued_subject := public.render_email_merge_fields(template.subject, new.id);
      insert into public.customer_emails (
        job_id, customer_id, template_id, direction, sender, recipient, subject, body,
        status, is_automated, automation_rule_id, automation_transition_id
      ) values (
        new.id, new.customer_id, template.id, 'outbound', coalesce(company_email,''), recipient_email,
        queued_subject, public.render_email_merge_fields(template.body, new.id), 'queued', true, rule.id, transition_id
      ) on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists jobs_queue_customer_emails on public.jobs;
create trigger jobs_queue_customer_emails
after insert or update of status on public.jobs
for each row execute function public.queue_job_status_emails();

commit;
