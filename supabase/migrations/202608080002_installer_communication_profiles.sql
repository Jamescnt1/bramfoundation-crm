begin;

create table if not exists public.installer_contacts (
  id uuid primary key default gen_random_uuid(),
  installer_crew_id uuid not null references public.installer_crews(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  mobile_phone text,
  email text,
  preferred_channel text not null default 'none'
    check (preferred_channel in ('none', 'email', 'sms', 'both')),
  appointment_confirmations boolean not null default true,
  appointment_reminders boolean not null default true,
  schedule_changes boolean not null default true,
  trial_recipient_verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mobile_phone is not null or email is not null),
  check (preferred_channel not in ('sms', 'both') or mobile_phone is not null),
  check (preferred_channel not in ('email', 'both') or email is not null)
);

create unique index if not exists installer_contacts_crew_name_idx
  on public.installer_contacts(installer_crew_id, lower(name));
create index if not exists installer_contacts_active_crew_idx
  on public.installer_contacts(installer_crew_id, name)
  where active = true;
create index if not exists installer_contacts_mobile_idx
  on public.installer_contacts(mobile_phone)
  where mobile_phone is not null and active = true;

create or replace function public.prepare_installer_contact()
returns trigger language plpgsql set search_path = public as $$
begin
  new.name := btrim(new.name);
  new.mobile_phone := nullif(btrim(new.mobile_phone), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists installer_contacts_prepare on public.installer_contacts;
create trigger installer_contacts_prepare
before insert or update on public.installer_contacts
for each row execute function public.prepare_installer_contact();

alter table public.installer_contacts enable row level security;

drop policy if exists "Active employees can view installer contacts" on public.installer_contacts;
create policy "Active employees can view installer contacts" on public.installer_contacts
for select to authenticated using (public.current_employee_is_active());

drop policy if exists "Administrators can manage installer contacts" on public.installer_contacts;
create policy "Administrators can manage installer contacts" on public.installer_contacts
for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

commit;
