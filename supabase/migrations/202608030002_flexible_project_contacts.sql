begin;

alter table public.jobs
  add column if not exists project_contact_name text,
  add column if not exists project_contact_phone text,
  add column if not exists project_contact_description text;

update public.jobs job
set project_contact_name = coalesce(job.project_contact_name, nullif(btrim(concat_ws(' ', contact.first_name, contact.last_name)), '')),
    project_contact_phone = coalesce(job.project_contact_phone, contact.mobile_phone, contact.office_phone),
    project_contact_description = coalesce(job.project_contact_description, contact.job_title)
from public.customer_contacts contact
where contact.id = job.project_contact_id
  and job.project_contact_id is not null;

create or replace function public.render_email_merge_fields(source text, target_job_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare result text := source; job_row public.jobs%rowtype; recipient_name text; company_name text; company_phone text;
  employee_name text; appointment_date text; appointment_time text;
begin
  select * into job_row from public.jobs where id = target_job_id;
  select coalesce(nullif(btrim(job_row.project_contact_name), ''),
                  nullif(btrim(concat_ws(' ', project_contact.first_name, project_contact.last_name)), ''),
                  nullif(btrim(job_row.project_customer_name), ''), customer.full_name, job_row.customer_name)
    into recipient_name
  from public.customers customer
  left join public.customer_contacts project_contact on project_contact.id = job_row.project_contact_id
  where customer.id = job_row.customer_id;
  recipient_name := coalesce(recipient_name, job_row.project_contact_name, job_row.project_customer_name, job_row.customer_name, 'Customer');
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

commit;
