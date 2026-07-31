begin;

create table if not exists public.appointment_types (
  key text primary key,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_types_key_format
    check (key ~ '^[a-z][a-z0-9_]{1,63}$')
);

create unique index if not exists appointment_types_normalized_name_idx
  on public.appointment_types (lower(btrim(name)));
create index if not exists appointment_types_active_sort_idx
  on public.appointment_types (active, sort_order, name);

insert into public.appointment_types (key, name, sort_order)
values
  ('appointment', 'Customer Meeting', 0),
  ('measure', 'Floor Measure', 1),
  ('installation', 'Install', 2),
  ('job_walk', 'Job Walk', 3),
  ('material_selection', 'Material Selection', 4),
  ('builder_meeting', 'Builder Meeting', 5),
  ('customer_meeting', 'Customer Meeting (Legacy)', 6),
  ('follow_up', 'Follow-up', 7),
  ('other', 'Other', 8)
on conflict (key) do nothing;

create or replace function public.prepare_appointment_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if new.name = '' then raise exception 'Name cannot be blank'; end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointment_types_prepare on public.appointment_types;
create trigger appointment_types_prepare
before insert or update on public.appointment_types
for each row execute function public.prepare_appointment_type();

drop trigger if exists appointment_types_audit on public.appointment_types;
create trigger appointment_types_audit
after insert or update or delete on public.appointment_types
for each row execute function public.audit_administration_configuration();

alter table public.appointments
  drop constraint if exists appointments_appointment_type_check;
alter table public.appointments
  drop constraint if exists appointments_appointment_type_fkey;
alter table public.appointments
  add constraint appointments_appointment_type_fkey
  foreign key (appointment_type)
  references public.appointment_types(key)
  on update cascade
  on delete restrict;

alter table public.appointment_types enable row level security;

drop policy if exists "Authenticated users can view appointment types"
  on public.appointment_types;
create policy "Authenticated users can view appointment types"
on public.appointment_types for select to authenticated using (true);

drop policy if exists "Administrators can manage appointment types"
  on public.appointment_types;
create policy "Administrators can manage appointment types"
on public.appointment_types for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

commit;
