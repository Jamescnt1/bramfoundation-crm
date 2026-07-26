begin;

create or replace function public.enforce_install_scheduled_requirement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.installation_required is distinct from new.installation_required
     )
     and new.installation_required
     and (
       new.status = 'install_scheduled'
       or lower(new.status) in ('install scheduled', 'installation scheduled')
     )
     and not public.job_has_install_appointment(new.id) then
    raise exception 'INSTALL_APPOINTMENT_REQUIRED: Schedule an installation before moving this job to Install Scheduled.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
