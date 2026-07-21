begin;

create or replace function public.enforce_job_qf_number()
returns trigger
language plpgsql
as $$
begin
  new.qfloors_job_number := nullif(btrim(new.qfloors_job_number), '');

  if new.status in (
    'Estimate Sent',
    'Follow-Up',
    'Negotiating',
    'Waiting Approval',
    'Won',
    'Sold',
    'Approved',
    'Ready for Production',
    'Materials Ordered',
    'Installation Scheduled',
    'Install Scheduled',
    'Installation Complete',
    'Closed',
    'Complete',
    'Lost'
  ) and new.qfloors_job_number is null then
    raise exception 'QF_NUMBER_REQUIRED: QF# is required at Estimate Sent and every later pipeline stage.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enforce_qf_number on public.jobs;

create trigger jobs_enforce_qf_number
before insert or update on public.jobs
for each row
execute function public.enforce_job_qf_number();

create or replace function public.log_job_qf_number_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.qfloors_job_number is not null then
    insert into public.job_activities (
      job_id,
      activity_type,
      description,
      old_value,
      new_value
    ) values (
      new.id,
      'qf_number_changed',
      'QF# added',
      null,
      new.qfloors_job_number
    );
  elsif tg_op = 'UPDATE' and old.qfloors_job_number is distinct from new.qfloors_job_number then
    insert into public.job_activities (
      job_id,
      activity_type,
      description,
      old_value,
      new_value
    ) values (
      new.id,
      'qf_number_changed',
      case
        when old.qfloors_job_number is null then 'QF# added'
        when new.qfloors_job_number is null then 'QF# removed'
        else 'QF# changed'
      end,
      old.qfloors_job_number,
      new.qfloors_job_number
    );
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_log_qf_number_change on public.jobs;

create trigger jobs_log_qf_number_change
after insert or update on public.jobs
for each row
execute function public.log_job_qf_number_change();

commit;
