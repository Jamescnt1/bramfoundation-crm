alter table public.appointments
  drop constraint if exists appointments_appointment_type_check;

alter table public.appointments
  add constraint appointments_appointment_type_check
  check (
    appointment_type in (
      'appointment',
      'measure',
      'installation',
      'follow_up',
      'job_walk',
      'other'
    )
  );

