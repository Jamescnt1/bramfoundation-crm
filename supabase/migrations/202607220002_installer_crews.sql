create table if not exists public.installer_crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists installer_crews_name_lower_idx
  on public.installer_crews (lower(name));

alter table public.appointments
  add column if not exists installer_crew_id uuid
  references public.installer_crews(id) on delete set null;

create index if not exists appointments_installer_crew_idx
  on public.appointments(installer_crew_id);

create or replace function public.set_installer_crew_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists installer_crews_set_updated_at on public.installer_crews;
create trigger installer_crews_set_updated_at
before update on public.installer_crews
for each row execute function public.set_installer_crew_updated_at();

alter table public.installer_crews enable row level security;

drop policy if exists "Active employees can view installer crews" on public.installer_crews;
create policy "Active employees can view installer crews"
on public.installer_crews for select to authenticated
using (public.current_employee_is_active());

drop policy if exists "Administrators can manage installer crews" on public.installer_crews;
create policy "Administrators can manage installer crews"
on public.installer_crews for all to authenticated
using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

insert into public.installer_crews (name, sort_order)
select 'Install Crew 1', 0
where not exists (select 1 from public.installer_crews);
