begin;

alter table public.jobs
  add column if not exists contract_amount numeric(14,2),
  add column if not exists billed_at timestamptz;

alter table public.jobs drop constraint if exists jobs_contract_amount_positive;
alter table public.jobs add constraint jobs_contract_amount_positive
  check (contract_amount is null or contract_amount > 0);

alter table public.pipeline_stages
  add column if not exists contract_amount_required boolean not null default false;

with approved_stage as (
  select sort_order from public.pipeline_stages where slug = 'approved' limit 1
)
update public.pipeline_stages stages
set contract_amount_required = stages.active
  and stages.sort_order >= coalesce((select sort_order from approved_stage), 4);

create index if not exists jobs_contract_amount_reporting_idx
  on public.jobs (status, contract_amount) where archived_at is null;
create index if not exists jobs_billed_at_idx
  on public.jobs (billed_at) where billed_at is not null and archived_at is null;

create or replace function public.job_stage_requires_contract_amount(job_status text)
returns boolean language sql stable set search_path = public as $$
  select coalesce((
    select stages.contract_amount_required
    from public.pipeline_stages stages
    where stages.slug = job_status
       or lower(stages.label) = lower(job_status)
       or stages.slug = (
         select aliases.stage_slug from public.pipeline_stage_aliases aliases
         where lower(aliases.alias) = lower(job_status) limit 1
       )
    order by stages.active desc limit 1
  ), false);
$$;

create or replace function public.enforce_job_contract_amount()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.contract_amount is not null then
    new.contract_amount := round(new.contract_amount, 2);
  end if;
  if public.job_stage_requires_contract_amount(new.status)
     and (new.contract_amount is null or new.contract_amount <= 0) then
    raise exception 'CONTRACT_AMOUNT_REQUIRED: Contract Amount is required at Approved and every later active pipeline stage.'
      using errcode = '23514';
  end if;
  if new.billed_at is not null and (new.contract_amount is null or new.contract_amount <= 0) then
    raise exception 'CONTRACT_AMOUNT_REQUIRED: Contract Amount is required before a job can be marked billed.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_enforce_contract_amount on public.jobs;
create trigger jobs_enforce_contract_amount before insert or update on public.jobs
for each row execute function public.enforce_job_contract_amount();

create or replace function public.log_job_financial_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.contract_amount is not null then
    insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
    values (new.id, 'contract_amount_changed', 'Contract Amount added', null, new.contract_amount::text);
  elsif tg_op = 'UPDATE' and old.contract_amount is distinct from new.contract_amount then
    insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
    values (
      new.id, 'contract_amount_changed',
      case when old.contract_amount is null then 'Contract Amount added'
           when new.contract_amount is null then 'Contract Amount removed'
           else 'Contract Amount changed' end,
      old.contract_amount::text, new.contract_amount::text
    );
  end if;
  if tg_op = 'UPDATE' and old.billed_at is distinct from new.billed_at then
    insert into public.job_activities (job_id, activity_type, description, old_value, new_value)
    values (
      new.id, 'billing_status_changed',
      case when new.billed_at is null then 'Job marked not billed' else 'Job marked billed' end,
      old.billed_at::text, new.billed_at::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_log_financial_changes on public.jobs;
create trigger jobs_log_financial_changes after insert or update on public.jobs
for each row execute function public.log_job_financial_changes();

commit;
