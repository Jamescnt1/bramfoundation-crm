begin;

-- The unified production workflow is reversible. Legacy pipeline values are
-- retained on each migrated job and the legacy stages are archived, not deleted.
alter table public.jobs
  add column if not exists legacy_production_status text;

do $$
declare existing_slug text;
begin
  if not exists (select 1 from public.pipeline_stages where slug = 'in_progress') then
    select slug into existing_slug from public.pipeline_stages
    where lower(btrim(label)) = 'in progress' limit 1;
    if existing_slug is not null then
      update public.jobs set status = 'in_progress' where status = existing_slug;
      update public.pipeline_stages set slug = 'in_progress' where slug = existing_slug;
    end if;
  end if;
end
$$;

insert into public.pipeline_stages
  (slug, label, color_key, sort_order, active, terminal, lead_queue,
   qf_number_required, contract_amount_required, system_required, behavior)
values
  ('in_progress', 'In Progress', 'blue', 5, true, false, false, true, true, true,
   '{"fixed":true,"production_workflow":true}'::jsonb)
on conflict (slug) do update
set label = 'In Progress',
    active = true,
    system_required = true,
    behavior = coalesce(pipeline_stages.behavior, '{}'::jsonb)
      || '{"fixed":true,"production_workflow":true}'::jsonb;

update public.pipeline_stages
set active = false
where slug in ('materials_ordered', 'install_scheduled', 'work_order_sent');

update public.pipeline_stages
set sort_order = case
  when slug = 'in_progress' then 5
  when slug = 'complete' then 6
  when slug = 'lost' then 7
  else sort_order
end
where slug in ('in_progress', 'complete', 'lost');

insert into public.pipeline_stage_aliases (alias, stage_slug) values
  ('In Progress', 'in_progress'),
  ('Materials Ordered', 'in_progress'),
  ('Ready for Production', 'in_progress'),
  ('Install Scheduled', 'in_progress'),
  ('Installation Scheduled', 'in_progress'),
  ('Work Order Sent', 'in_progress')
on conflict (alias) do update set stage_slug = excluded.stage_slug;

update public.jobs
set legacy_production_status = status,
    status = 'in_progress'
where archived_at is null
  and lower(replace(status, '_', ' ')) in (
    'materials ordered', 'ready for production', 'install scheduled',
    'installation scheduled', 'work order sent'
  );

create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text not null,
  color_key text not null default 'blue' check (color_key in (
    'blue', 'amber', 'violet', 'orange', 'emerald', 'cyan',
    'indigo', 'teal', 'red', 'gray'
  )),
  ordering_required boolean not null default true,
  installation_required boolean not null default true,
  work_order_required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists material_categories_name_idx
  on public.material_categories (lower(btrim(name)));
create unique index if not exists material_categories_abbreviation_idx
  on public.material_categories (lower(btrim(abbreviation)));

insert into public.material_categories
  (name, abbreviation, color_key, ordering_required, installation_required, work_order_required, sort_order)
values
  ('Carpet', 'C', 'blue', true, true, true, 0),
  ('Pad', 'P', 'gray', true, true, true, 1),
  ('Tile', 'T', 'orange', true, true, true, 2),
  ('LVP', 'L', 'violet', true, true, true, 3),
  ('Hardwood', 'HW', 'amber', true, true, true, 4),
  ('Base', 'B', 'emerald', true, true, true, 5),
  ('Sundries', 'S', 'cyan', true, false, false, 6),
  ('Other', 'O', 'gray', true, true, true, 7)
on conflict do nothing;

create table if not exists public.job_material_scopes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  material_category_id uuid not null references public.material_categories(id) on delete restrict,
  description text,
  ordering_required boolean not null default true,
  installation_required boolean not null default true,
  work_order_required boolean not null default true,
  material_status text not null default 'needs_ordering' check (material_status in (
    'needs_ordering', 'ordered', 'partially_received', 'ready', 'issue', 'excluded'
  )),
  eta_date date,
  ordered_at timestamptz,
  ready_at timestamptz,
  issue_note text,
  excluded_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.employees(id) on delete set null,
  updated_by uuid references public.employees(id) on delete set null
);

create index if not exists job_material_scopes_job_idx
  on public.job_material_scopes(job_id, sort_order, created_at);
create index if not exists job_material_scopes_attention_idx
  on public.job_material_scopes(job_id, material_status, eta_date);

create table if not exists public.job_material_scope_appointments (
  material_scope_id uuid not null references public.job_material_scopes(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_scope_id, appointment_id)
);

create table if not exists public.production_workflow_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  require_eta_when_ordered boolean not null default true,
  allow_unknown_eta boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id) on delete set null
);
insert into public.production_workflow_settings(singleton) values (true)
on conflict (singleton) do nothing;

create or replace function public.prepare_production_record()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_table_name = 'material_categories' then
    new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
    new.abbreviation := upper(btrim(new.abbreviation));
  end if;
  return new;
end;
$$;

drop trigger if exists material_categories_prepare on public.material_categories;
create trigger material_categories_prepare before insert or update on public.material_categories
for each row execute function public.prepare_production_record();
drop trigger if exists job_material_scopes_prepare on public.job_material_scopes;
create trigger job_material_scopes_prepare before insert or update on public.job_material_scopes
for each row execute function public.prepare_production_record();

-- Extend the existing editable automation engine with production milestones.
alter table public.automation_rules
  drop constraint if exists automation_rules_trigger_event_check;
alter table public.automation_rules
  add constraint automation_rules_trigger_event_check check (trigger_event in (
    'job_created', 'job_status_changed', 'customer_created',
    'appointment_scheduled', 'appointment_completed', 'task_completed',
    'lead_untouched_daily', 'material_ordered', 'material_ready',
    'all_materials_ordered', 'all_materials_ready', 'work_order_sent',
    'all_work_orders_sent'
  ));

create or replace function public.handle_material_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  customer uuid;
  salesperson text;
  assigned_employee uuid;
  all_ordered boolean;
  all_ready boolean;
begin
  select customer_id, jobs.salesperson, assigned_employee_id
  into customer, salesperson, assigned_employee
  from public.jobs where id = new.job_id;

  if new.material_status = 'ordered'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_ordered', null, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;
  if new.material_status = 'ready'
     and (tg_op = 'INSERT' or old.material_status is distinct from new.material_status) then
    perform public.run_crm_automations('material_ready', null, new.job_id, customer, salesperson, assigned_employee, new.id);
  end if;

  select
    bool_and(not ordering_required or material_status in ('ordered','partially_received','ready','excluded')),
    bool_and(material_status in ('ready','excluded'))
  into all_ordered, all_ready
  from public.job_material_scopes where job_id = new.job_id;

  if all_ordered then
    perform public.run_crm_automations('all_materials_ordered', null, new.job_id, customer, salesperson, assigned_employee, new.job_id);
  end if;
  if all_ready then
    perform public.run_crm_automations('all_materials_ready', null, new.job_id, customer, salesperson, assigned_employee, new.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists job_material_scopes_run_automations on public.job_material_scopes;
create trigger job_material_scopes_run_automations
after insert or update of material_status on public.job_material_scopes
for each row execute function public.handle_material_automation_events();

create or replace function public.handle_work_order_automation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  customer uuid; salesperson text; employee uuid; all_sent boolean;
begin
  if new.job_id is null or new.appointment_type <> 'installation' then return new; end if;
  if new.work_order_status in ('sent','acknowledged')
     and (old.work_order_status is distinct from new.work_order_status) then
    select customer_id, jobs.salesperson, assigned_employee_id
    into customer, salesperson, employee from public.jobs where id = new.job_id;
    perform public.run_crm_automations('work_order_sent', null, new.job_id, customer, salesperson, employee, new.id);
    select bool_and(work_order_status in ('sent','acknowledged')) into all_sent
    from public.appointments
    where job_id = new.job_id and appointment_type = 'installation' and status <> 'cancelled';
    if all_sent then
      perform public.run_crm_automations('all_work_orders_sent', null, new.job_id, customer, salesperson, employee, new.job_id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists appointments_run_work_order_automations on public.appointments;
create trigger appointments_run_work_order_automations
after update of work_order_status on public.appointments
for each row execute function public.handle_work_order_automation_events();

insert into public.automation_rules
  (name, trigger_event, trigger_value, action_type, trigger_status, task_title,
   due_offset_days, assignment_type, active, sort_order)
select * from (values
  ('Order materials when production begins', 'job_status_changed', 'in_progress', 'create_task', 'in_progress', 'Order materials', 0, 'job_salesperson', true, 0),
  ('Confirm material ETA', 'material_ordered', null, 'create_task', null, 'Confirm material ETA', 0, 'job_salesperson', true, 0),
  ('Schedule installation when materials are ready', 'all_materials_ready', null, 'create_task', null, 'Schedule installation', 0, 'job_salesperson', true, 0),
  ('Send work order after installation is scheduled', 'appointment_scheduled', 'installation', 'create_task', null, 'Send crew work order', 0, 'job_salesperson', true, 0)
) defaults(name, trigger_event, trigger_value, action_type, trigger_status, task_title,
           due_offset_days, assignment_type, active, sort_order)
where not exists (
  select 1 from public.automation_rules existing
  where existing.trigger_event = defaults.trigger_event
    and existing.trigger_value is not distinct from defaults.trigger_value
    and existing.task_title = defaults.task_title
);

-- The legacy appointment rule would move unified jobs back into an archived
-- stage. Preserve it for rollback, but keep it disabled while In Progress is active.
update public.automation_rules
set active = false
where action_type = 'update_job_status'
  and lower(replace(coalesce(target_status, ''), '_', ' ')) in ('install scheduled', 'installation scheduled');

alter table public.material_categories enable row level security;
alter table public.job_material_scopes enable row level security;
alter table public.job_material_scope_appointments enable row level security;
alter table public.production_workflow_settings enable row level security;

drop policy if exists "Active employees can view material categories" on public.material_categories;
create policy "Active employees can view material categories" on public.material_categories
for select to authenticated using (public.current_employee_is_active());
drop policy if exists "Administrators can manage material categories" on public.material_categories;
create policy "Administrators can manage material categories" on public.material_categories
for all to authenticated using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

drop policy if exists "Active employees can manage job material scopes" on public.job_material_scopes;
create policy "Active employees can manage job material scopes" on public.job_material_scopes
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can manage material appointment links" on public.job_material_scope_appointments;
create policy "Active employees can manage material appointment links" on public.job_material_scope_appointments
for all to authenticated using (public.current_employee_is_active())
with check (public.current_employee_is_active());
drop policy if exists "Active employees can view production settings" on public.production_workflow_settings;
create policy "Active employees can view production settings" on public.production_workflow_settings
for select to authenticated using (public.current_employee_is_active());
drop policy if exists "Administrators can manage production settings" on public.production_workflow_settings;
create policy "Administrators can manage production settings" on public.production_workflow_settings
for all to authenticated using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

create or replace function public.set_production_workflow_enabled(next_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_employee_is_administrator() then
    raise exception 'Administrator access required';
  end if;

  if next_enabled then
    update public.pipeline_stages set active = true where slug = 'in_progress';
    update public.pipeline_stages set active = false
      where slug in ('materials_ordered', 'install_scheduled', 'work_order_sent');
    update public.jobs
    set legacy_production_status = coalesce(legacy_production_status, status), status = 'in_progress'
    where archived_at is null and lower(replace(status, '_', ' ')) in (
      'materials ordered', 'ready for production', 'install scheduled',
      'installation scheduled', 'work order sent'
    );
    insert into public.pipeline_stage_aliases(alias, stage_slug) values
      ('Materials Ordered', 'in_progress'), ('Ready for Production', 'in_progress'),
      ('Install Scheduled', 'in_progress'), ('Installation Scheduled', 'in_progress'),
      ('Work Order Sent', 'in_progress')
    on conflict(alias) do update set stage_slug = excluded.stage_slug;
  else
    update public.pipeline_stages set active = false where slug = 'in_progress';
    update public.pipeline_stages set active = true
      where slug in ('materials_ordered', 'install_scheduled');
    update public.jobs jobs
    set status = coalesce(jobs.legacy_production_status,
      case
        when exists (select 1 from public.appointments a where a.job_id = jobs.id and a.appointment_type = 'installation' and a.status <> 'cancelled' and a.work_order_status in ('sent','acknowledged')) then 'install_scheduled'
        when exists (select 1 from public.appointments a where a.job_id = jobs.id and a.appointment_type = 'installation' and a.status <> 'cancelled') then 'install_scheduled'
        when exists (select 1 from public.job_material_scopes s where s.job_id = jobs.id and s.material_status in ('ordered','partially_received','ready')) then 'materials_ordered'
        else 'approved'
      end)
    where jobs.status = 'in_progress';
    insert into public.pipeline_stage_aliases(alias, stage_slug) values
      ('Materials Ordered', 'materials_ordered'), ('Ready for Production', 'materials_ordered'),
      ('Install Scheduled', 'install_scheduled'), ('Installation Scheduled', 'install_scheduled')
    on conflict(alias) do update set stage_slug = excluded.stage_slug;
  end if;

  update public.production_workflow_settings
  set enabled = next_enabled, updated_at = now(),
      updated_by = (select id from public.employees where auth_user_id = auth.uid() limit 1)
  where singleton;
end;
$$;

revoke all on function public.set_production_workflow_enabled(boolean) from public;
grant execute on function public.set_production_workflow_enabled(boolean) to authenticated;

commit;
