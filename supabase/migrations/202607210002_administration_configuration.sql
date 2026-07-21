begin;

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  company_name text not null default 'Bram Flooring',
  phone text,
  email text,
  website text,
  address text,
  timezone text not null default 'America/Phoenix',
  locale text not null default 'en-US',
  currency text not null default 'USD',
  business_hours jsonb not null default '{}'::jsonb,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (singleton_key, company_name)
values (true, 'Bram Flooring')
on conflict (singleton_key) do nothing;

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lead_sources_normalized_name_idx
  on public.lead_sources (lower(btrim(name)));
create index if not exists lead_sources_active_sort_idx
  on public.lead_sources (active, sort_order, name);

insert into public.lead_sources (name, sort_order)
values
  ('Google', 0),
  ('Yelp', 1),
  ('Rosie on the House', 2),
  ('Shaw', 3),
  ('Insurance', 4),
  ('Real Estate', 5),
  ('Commercial', 6),
  ('Referral', 7),
  ('Walk-in', 8)
on conflict do nothing;

create unique index if not exists task_types_normalized_name_idx
  on public.task_types (lower(btrim(name)));

create or replace function public.prepare_administration_configuration()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name <> 'company_settings' then
    new.name := btrim(new.name);
    if new.name = '' then
      raise exception 'Name cannot be blank';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_settings_prepare on public.company_settings;
create trigger company_settings_prepare
before insert or update on public.company_settings
for each row execute function public.prepare_administration_configuration();

drop trigger if exists lead_sources_prepare on public.lead_sources;
create trigger lead_sources_prepare
before insert or update on public.lead_sources
for each row execute function public.prepare_administration_configuration();

drop trigger if exists task_types_prepare on public.task_types;
create trigger task_types_prepare
before insert or update on public.task_types
for each row execute function public.prepare_administration_configuration();

create or replace function public.audit_administration_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  row_id uuid;
  row_label text;
  before_data jsonb;
  after_data jsonb;
  row_data jsonb;
begin
  select id into actor_id
  from public.employees
  where auth_user_id = auth.uid()
  limit 1;

  before_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data := coalesce(after_data, before_data);
  row_id := (row_data ->> 'id')::uuid;
  row_label := case
    when tg_table_name = 'company_settings' then row_data ->> 'company_name'
    else row_data ->> 'name'
  end;

  insert into public.admin_audit_log (
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    details
  ) values (
    actor_id,
    lower(tg_op),
    tg_table_name,
    row_id,
    row_label,
    jsonb_build_object(
      'before', before_data,
      'after', after_data
    )
  );

  return null;
end;
$$;

drop trigger if exists company_settings_audit on public.company_settings;
create trigger company_settings_audit
after insert or update or delete on public.company_settings
for each row execute function public.audit_administration_configuration();

drop trigger if exists lead_sources_audit on public.lead_sources;
create trigger lead_sources_audit
after insert or update or delete on public.lead_sources
for each row execute function public.audit_administration_configuration();

drop trigger if exists task_types_audit on public.task_types;
create trigger task_types_audit
after insert or update or delete on public.task_types
for each row execute function public.audit_administration_configuration();

alter table public.company_settings enable row level security;
alter table public.lead_sources enable row level security;

drop policy if exists "Authenticated users can view company settings" on public.company_settings;
create policy "Authenticated users can view company settings"
on public.company_settings for select to authenticated using (true);

drop policy if exists "Administrators can manage company settings" on public.company_settings;
create policy "Administrators can manage company settings"
on public.company_settings for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

drop policy if exists "Authenticated users can view lead sources" on public.lead_sources;
create policy "Authenticated users can view lead sources"
on public.lead_sources for select to authenticated using (true);

drop policy if exists "Administrators can manage lead sources" on public.lead_sources;
create policy "Administrators can manage lead sources"
on public.lead_sources for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

commit;
