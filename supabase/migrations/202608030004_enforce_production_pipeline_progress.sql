begin;

-- Keep the database QF# rule aligned with configurable pipeline stages and
-- modern slug values such as estimate_sent and in_progress.
create or replace function public.job_stage_requires_qf_number(job_status text)
returns boolean language sql stable set search_path = public as $$
  select coalesce((
    select stages.qf_number_required
    from public.pipeline_stages stages
    where stages.slug = job_status
       or lower(stages.label) = lower(job_status)
       or stages.slug = (
         select aliases.stage_slug
         from public.pipeline_stage_aliases aliases
         where lower(aliases.alias) = lower(job_status)
         limit 1
       )
    order by stages.active desc
    limit 1
  ), false);
$$;

create or replace function public.enforce_job_qf_number()
returns trigger language plpgsql set search_path = public as $$
begin
  new.qfloors_job_number := nullif(btrim(new.qfloors_job_number), '');

  if public.job_stage_requires_qf_number(new.status)
     and new.qfloors_job_number is null then
    raise exception 'QF_NUMBER_REQUIRED: QF# is required at Estimate Sent and every later pipeline stage.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Advance a job to the fixed In Progress stage when real production work
-- begins. This is a minimum-stage rule: it never moves terminal, archived, or
-- later-stage jobs backward.
create or replace function public.advance_job_to_production(related_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  production_enabled boolean;
  target_order integer;
  current_order integer;
  current_terminal boolean;
  current_archived_at timestamptz;
  current_qf_number text;
  current_contract_amount numeric;
begin
  if related_job_id is null then return; end if;

  select settings.enabled into production_enabled
  from public.production_workflow_settings settings
  where settings.singleton = true;

  if not coalesce(production_enabled, false) then return; end if;

  select stages.sort_order into target_order
  from public.pipeline_stages stages
  where stages.slug = 'in_progress' and stages.active = true
  limit 1;

  if target_order is null then return; end if;

  select jobs.archived_at, jobs.qfloors_job_number, jobs.contract_amount,
         stages.sort_order, coalesce(stages.terminal, false)
  into current_archived_at, current_qf_number, current_contract_amount,
       current_order, current_terminal
  from public.jobs jobs
  left join public.pipeline_stage_aliases aliases
    on lower(aliases.alias) = lower(jobs.status)
  left join public.pipeline_stages stages
    on stages.slug = jobs.status
    or lower(stages.label) = lower(jobs.status)
    or stages.slug = aliases.stage_slug
  where jobs.id = related_job_id
  order by stages.active desc nulls last
  limit 1;

  if current_archived_at is not null or current_terminal then return; end if;
  if current_order is not null and current_order >= target_order then return; end if;

  if nullif(btrim(current_qf_number), '') is null then
    raise exception 'PRODUCTION_QF_NUMBER_REQUIRED: Enter the job QF# before beginning production.'
      using errcode = '23514';
  end if;
  if current_contract_amount is null or current_contract_amount <= 0 then
    raise exception 'PRODUCTION_CONTRACT_AMOUNT_REQUIRED: Enter the Contract Amount before beginning production.'
      using errcode = '23514';
  end if;

  update public.jobs
  set status = 'in_progress'
  where id = related_job_id
    and archived_at is null
    and status is distinct from 'in_progress';
end;
$$;

revoke all on function public.advance_job_to_production(uuid) from public;

create or replace function public.advance_material_job_to_production()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.material_status in ('ordered', 'partially_received', 'ready', 'issue')
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status
          or old.eta_date is distinct from new.eta_date) then
    perform public.advance_job_to_production(new.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists job_material_scopes_advance_pipeline on public.job_material_scopes;
create trigger job_material_scopes_advance_pipeline
after insert or update of material_status, eta_date on public.job_material_scopes
for each row execute function public.advance_material_job_to_production();

create or replace function public.advance_appointment_job_to_production()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.job_id is not null
     and new.appointment_type in ('installation', 'job_walk')
     and new.status <> 'cancelled'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.starts_at is distinct from new.starts_at
       or old.work_order_status is distinct from new.work_order_status
     ) then
    perform public.advance_job_to_production(new.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_advance_production_pipeline on public.appointments;
create trigger appointments_advance_production_pipeline
after insert or update of status, starts_at, work_order_status on public.appointments
for each row execute function public.advance_appointment_job_to_production();

commit;
