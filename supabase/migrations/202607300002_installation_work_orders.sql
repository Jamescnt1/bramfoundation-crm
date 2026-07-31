begin;

alter table public.appointments
  add column if not exists installation_scope text,
  add column if not exists work_order_status text not null default 'not_sent',
  add column if not exists work_order_sent_at timestamptz,
  add column if not exists work_order_sent_by uuid
    references public.employees(id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_work_order_status_check;

alter table public.appointments
  add constraint appointments_work_order_status_check
  check (work_order_status in ('not_sent', 'sent', 'acknowledged'));

create index if not exists appointments_job_work_order_idx
  on public.appointments(job_id, work_order_status)
  where appointment_type = 'installation'
    and status <> 'cancelled';

comment on column public.appointments.installation_scope is
  'The flooring scope assigned to this installation crew.';

comment on column public.appointments.work_order_status is
  'Tracks the work order independently for each installation appointment and crew.';

commit;
