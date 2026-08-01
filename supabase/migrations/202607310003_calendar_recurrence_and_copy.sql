begin;

alter table public.appointments
  add column if not exists all_day boolean not null default false,
  add column if not exists recurrence_series_id uuid,
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_interval integer,
  add column if not exists recurrence_ends_on date,
  add column if not exists copied_from_id uuid references public.appointments(id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_recurrence_frequency_check,
  drop constraint if exists appointments_recurrence_interval_check;

alter table public.appointments
  add constraint appointments_recurrence_frequency_check
    check (recurrence_frequency is null or recurrence_frequency in ('daily', 'weekly', 'monthly')),
  add constraint appointments_recurrence_interval_check
    check (recurrence_interval is null or recurrence_interval between 1 and 52);

create index if not exists appointments_recurrence_series_idx
  on public.appointments (recurrence_series_id, starts_at);
create index if not exists appointments_copied_from_idx
  on public.appointments (copied_from_id);

commit;
