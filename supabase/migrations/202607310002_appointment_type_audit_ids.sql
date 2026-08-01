begin;

alter table public.appointment_types
  add column if not exists id uuid not null default gen_random_uuid();

create unique index if not exists appointment_types_id_idx
  on public.appointment_types (id);

commit;
