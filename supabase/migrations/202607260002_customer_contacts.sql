begin;

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  job_title text,
  email text,
  office_phone text,
  mobile_phone text,
  notes text,
  active boolean not null default true,
  archived_at timestamptz,
  archived_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs
  add column if not exists company_contact_id uuid
    references public.customer_contacts(id) on delete set null,
  add column if not exists job_site_contact_id uuid
    references public.customer_contacts(id) on delete set null;

create index if not exists customer_contacts_customer_name_idx
  on public.customer_contacts(customer_id, last_name, first_name)
  where archived_at is null;
create index if not exists customer_contacts_lookup_idx
  on public.customer_contacts(email, mobile_phone, office_phone)
  where archived_at is null;
create index if not exists jobs_company_contact_idx
  on public.jobs(company_contact_id) where company_contact_id is not null;
create index if not exists jobs_site_contact_idx
  on public.jobs(job_site_contact_id) where job_site_contact_id is not null;

create or replace function public.set_customer_contact_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_contacts_set_updated_at on public.customer_contacts;
create trigger customer_contacts_set_updated_at
before update on public.customer_contacts
for each row execute function public.set_customer_contact_updated_at();

create or replace function public.validate_job_contact_relationships()
returns trigger language plpgsql as $$
declare
  company_parent_id uuid;
begin
  if new.company_contact_id is not null then
    select customer_id into company_parent_id
    from public.customer_contacts
    where id = new.company_contact_id
      and archived_at is null
      and active = true;

    if company_parent_id is null then
      raise exception 'The selected company contact is unavailable.';
    end if;

    if new.customer_id is null or company_parent_id <> new.customer_id then
      raise exception 'Company Contact must belong to the job parent customer.';
    end if;
  end if;

  if new.job_site_contact_id is not null and not exists (
    select 1 from public.customer_contacts
    where id = new.job_site_contact_id
      and archived_at is null
      and active = true
  ) then
    raise exception 'The selected job site contact is unavailable.';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_validate_contacts on public.jobs;
create trigger jobs_validate_contacts
before insert or update of customer_id, company_contact_id, job_site_contact_id
on public.jobs
for each row execute function public.validate_job_contact_relationships();

alter table public.customer_contacts enable row level security;

drop policy if exists "Employees can view customer contacts" on public.customer_contacts;
create policy "Employees can view customer contacts"
on public.customer_contacts for select to authenticated
using (
  archived_at is null and exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active = true
  )
);

drop policy if exists "Customer managers can add contacts" on public.customer_contacts;
create policy "Customer managers can add contacts"
on public.customer_contacts for insert to authenticated
with check (
  exists (
    select 1 from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'customers.manage'
  )
);

drop policy if exists "Customer managers can update contacts" on public.customer_contacts;
create policy "Customer managers can update contacts"
on public.customer_contacts for update to authenticated
using (
  exists (
    select 1 from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('customers.manage', 'delete_customers')
  )
)
with check (
  exists (
    select 1 from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('customers.manage', 'delete_customers')
  )
);

commit;
