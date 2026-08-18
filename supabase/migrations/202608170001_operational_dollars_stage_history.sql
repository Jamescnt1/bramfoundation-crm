begin;

create table if not exists public.job_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  entered_at timestamptz not null default now(),
  contract_amount numeric(14,2),
  source text not null default 'live',
  created_at timestamptz not null default now()
);

alter table public.job_stage_transitions drop constraint if exists job_stage_transitions_contract_amount_positive;
alter table public.job_stage_transitions add constraint job_stage_transitions_contract_amount_positive
  check (contract_amount is null or contract_amount > 0);

create index if not exists job_stage_transitions_reporting_idx
  on public.job_stage_transitions (entered_at desc, to_stage, job_id);
create index if not exists job_stage_transitions_job_idx
  on public.job_stage_transitions (job_id, entered_at desc);

create or replace function public.record_job_stage_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.job_stage_transitions (
      job_id, from_stage, to_stage, entered_at, contract_amount, source
    ) values (
      new.id,
      case when tg_op = 'UPDATE' then old.status else null end,
      new.status,
      now(),
      new.contract_amount,
      'live'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_record_stage_transition on public.jobs;
create trigger jobs_record_stage_transition
after insert or update of status on public.jobs
for each row execute function public.record_job_stage_transition();

create or replace function public.record_job_billing_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.billed_at is not null
     and (tg_op = 'INSERT' or old.billed_at is distinct from new.billed_at)
     and not public.pipeline_stage_is_billed(new.status) then
    insert into public.job_stage_transitions (
      job_id, from_stage, to_stage, entered_at, contract_amount, source
    ) values (
      new.id, new.status, 'billed', new.billed_at, new.contract_amount, 'billing'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_record_billing_transition on public.jobs;
create trigger jobs_record_billing_transition
after insert or update of billed_at on public.jobs
for each row execute function public.record_job_billing_transition();

-- Recover exact legacy transition timestamps when a prior deployment recorded
-- status_changed activity. Contract amount is the best currently recoverable
-- value for those older events; all new transitions receive a true snapshot.
insert into public.job_stage_transitions (
  job_id, from_stage, to_stage, entered_at, contract_amount, source
)
select
  activity.job_id,
  activity.old_value,
  activity.new_value,
  activity.created_at,
  jobs.contract_amount,
  'activity_backfill'
from public.job_activities activity
join public.jobs jobs on jobs.id = activity.job_id
where activity.activity_type = 'status_changed'
  and activity.new_value is not null
  and not exists (
    select 1 from public.job_stage_transitions transition
    where transition.job_id = activity.job_id
      and transition.to_stage = activity.new_value
      and transition.entered_at = activity.created_at
  );

-- Preserve the current report's best-known legacy cohort for jobs without any
-- recoverable transition activity. This is intentionally marked as estimated.
insert into public.job_stage_transitions (
  job_id, from_stage, to_stage, entered_at, contract_amount, source
)
select jobs.id, null, jobs.status, jobs.updated_at, jobs.contract_amount, 'legacy_current'
from public.jobs jobs
where jobs.archived_at is null
  and not exists (
    select 1 from public.job_stage_transitions transition
    where transition.job_id = jobs.id
  );

-- Billing already has a trustworthy historical timestamp. Record it as a
-- milestone when no billed-stage transition was recoverable above.
insert into public.job_stage_transitions (
  job_id, from_stage, to_stage, entered_at, contract_amount, source
)
select jobs.id, jobs.status, 'billed', jobs.billed_at, jobs.contract_amount, 'billing_backfill'
from public.jobs jobs
where jobs.archived_at is null
  and jobs.billed_at is not null
  and not exists (
    select 1 from public.job_stage_transitions transition
    where transition.job_id = jobs.id
      and public.pipeline_stage_is_billed(transition.to_stage)
      and transition.source <> 'legacy_current'
  );

alter table public.job_stage_transitions enable row level security;
drop policy if exists "Active employees can access job stage transitions"
  on public.job_stage_transitions;
create policy "Active employees can access job stage transitions"
on public.job_stage_transitions for select to authenticated
using (public.current_employee_is_active());

commit;
