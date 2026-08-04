begin;

alter table public.jobs
  add column if not exists project_customer_name text,
  add column if not exists project_contact_id uuid
    references public.customer_contacts(id) on delete set null;

create index if not exists jobs_project_contact_idx
  on public.jobs(project_contact_id) where project_contact_id is not null;

create or replace function public.validate_job_contact_relationships()
returns trigger language plpgsql as $$
declare company_parent_id uuid;
begin
  if new.company_contact_id is not null then
    select customer_id into company_parent_id from public.customer_contacts
    where id = new.company_contact_id and archived_at is null and active = true;
    if company_parent_id is null then raise exception 'The selected company contact is unavailable.'; end if;
    if new.customer_id is null or company_parent_id <> new.customer_id then
      raise exception 'Company Contact must belong to the job parent customer.';
    end if;
  end if;
  if new.project_contact_id is not null and not exists (
    select 1 from public.customer_contacts where id = new.project_contact_id and archived_at is null and active = true
  ) then raise exception 'The selected project contact is unavailable.'; end if;
  if new.job_site_contact_id is not null and not exists (
    select 1 from public.customer_contacts where id = new.job_site_contact_id and archived_at is null and active = true
  ) then raise exception 'The selected job site contact is unavailable.'; end if;
  return new;
end;
$$;

drop trigger if exists jobs_validate_contacts on public.jobs;
create trigger jobs_validate_contacts
before insert or update of customer_id, company_contact_id, project_contact_id, job_site_contact_id on public.jobs
for each row execute function public.validate_job_contact_relationships();

update public.dashboard_rule_settings set enabled = false, updated_at = now()
where rule_key = 'missing_job_site_contact';

create or replace function public.render_email_merge_fields(source text, target_job_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare result text := source; job_row public.jobs%rowtype; recipient_name text; company_name text; company_phone text;
  employee_name text; appointment_date text; appointment_time text;
begin
  select * into job_row from public.jobs where id = target_job_id;
  select coalesce(nullif(btrim(concat_ws(' ', project_contact.first_name, project_contact.last_name)), ''),
                  nullif(btrim(job_row.project_customer_name), ''), customer.full_name, job_row.customer_name)
    into recipient_name
  from public.customers customer
  left join public.customer_contacts project_contact on project_contact.id = job_row.project_contact_id
  where customer.id = job_row.customer_id;
  recipient_name := coalesce(recipient_name, job_row.project_customer_name, job_row.customer_name, 'Customer');
  select settings.company_name, settings.phone into company_name, company_phone from public.company_settings settings where singleton_key = true limit 1;
  select employee.name into employee_name from public.employees employee where employee.id = job_row.assigned_employee_id;
  select to_char(appointment.starts_at at time zone coalesce((select timezone from public.company_settings where singleton_key = true limit 1),'America/Phoenix'), 'FMMonth FMDD, YYYY'),
         to_char(appointment.starts_at at time zone coalesce((select timezone from public.company_settings where singleton_key = true limit 1),'America/Phoenix'), 'FMHH12:MI AM')
    into appointment_date, appointment_time
  from public.appointments appointment where appointment.job_id = target_job_id and appointment.starts_at >= now()
  order by appointment.starts_at limit 1;
  result := replace(result, '{{customer_name}}', coalesce(recipient_name,''));
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
  recipient_email text; company_email text; queued_subject text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select coalesce(project_contact.email, new.email, customer.email)
    into recipient_email
  from public.customers customer
  left join public.customer_contacts project_contact on project_contact.id = new.project_contact_id
  where customer.id = new.customer_id;
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
end;
$$;

commit;
