begin;

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_]{1,49}$'),
  label text not null,
  color_key text not null default 'gray' check (color_key in (
    'blue', 'amber', 'violet', 'orange', 'emerald', 'cyan',
    'indigo', 'teal', 'red', 'gray'
  )),
  sort_order integer not null default 0,
  active boolean not null default true,
  terminal boolean not null default false,
  lead_queue boolean not null default false,
  qf_number_required boolean not null default false,
  system_required boolean not null default false,
  behavior jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pipeline_stages_normalized_label_idx
  on public.pipeline_stages (lower(btrim(label)));
create index if not exists pipeline_stages_active_order_idx
  on public.pipeline_stages (active, sort_order, label);

create table if not exists public.pipeline_stage_aliases (
  alias text primary key,
  stage_slug text not null references public.pipeline_stages(slug) on update cascade on delete restrict,
  created_at timestamptz not null default now()
);

insert into public.pipeline_stages
  (slug, label, color_key, sort_order, active, terminal, lead_queue, qf_number_required, system_required)
values
  ('new_lead', 'New Lead', 'blue', 0, true, false, true, false, true),
  ('floor_measure', 'Floor Measure', 'amber', 1, true, false, true, false, true),
  ('estimate_sent', 'Estimate Sent', 'violet', 2, true, false, false, true, true),
  ('waiting_approval', 'Waiting Approval', 'orange', 3, true, false, false, true, false),
  ('approved', 'Approved', 'emerald', 4, true, false, false, true, false),
  ('materials_ordered', 'Materials Ordered', 'cyan', 5, true, false, false, true, false),
  ('install_scheduled', 'Install Scheduled', 'indigo', 6, true, false, false, true, false),
  ('complete', 'Complete', 'teal', 7, true, true, false, true, true),
  ('lost', 'Lost', 'gray', 8, true, true, false, true, true)
on conflict (slug) do nothing;

insert into public.pipeline_stage_aliases (alias, stage_slug) values
  ('New Lead', 'new_lead'), ('Contacted', 'new_lead'),
  ('Appointment', 'floor_measure'), ('Measure Complete', 'floor_measure'), ('Floor Measure', 'floor_measure'),
  ('Estimate Sent', 'estimate_sent'),
  ('Follow-Up', 'waiting_approval'), ('Negotiating', 'waiting_approval'), ('Waiting Approval', 'waiting_approval'),
  ('Won', 'approved'), ('Sold', 'approved'), ('Approved', 'approved'),
  ('Ready for Production', 'materials_ordered'), ('Materials Ordered', 'materials_ordered'),
  ('Installation Scheduled', 'install_scheduled'), ('Install Scheduled', 'install_scheduled'),
  ('Installation Complete', 'complete'), ('Closed', 'complete'), ('Complete', 'complete'),
  ('Lost', 'lost')
on conflict (alias) do update set stage_slug = excluded.stage_slug;

-- Keep existing automation rules attached to stable identifiers when labels
-- are renamed later. Both compatibility columns are maintained by the app.
update public.automation_rules rules
set trigger_value = aliases.stage_slug,
    trigger_status = aliases.stage_slug
from public.pipeline_stage_aliases aliases
where rules.trigger_event = 'job_status_changed'
  and rules.trigger_value = aliases.alias;

update public.automation_rules rules
set target_status = aliases.stage_slug
from public.pipeline_stage_aliases aliases
where rules.target_status = aliases.alias;

create or replace function public.prepare_pipeline_stage()
returns trigger language plpgsql set search_path = public as $$
begin
  new.slug := lower(btrim(new.slug));
  new.label := regexp_replace(btrim(new.label), '\s+', ' ', 'g');
  if new.slug = '' or new.label = '' then
    raise exception 'Pipeline stage slug and label cannot be blank';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pipeline_stages_prepare on public.pipeline_stages;
create trigger pipeline_stages_prepare before insert or update on public.pipeline_stages
for each row execute function public.prepare_pipeline_stage();

create or replace function public.audit_pipeline_configuration()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid;
  payload jsonb;
  stage_label text;
begin
  select id into actor from public.employees where auth_user_id = auth.uid() limit 1;
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  stage_label := coalesce(payload ->> 'label', payload ->> 'slug', 'Pipeline stage');
  insert into public.admin_audit_log
    (actor_employee_id, entity_type, entity_id, action, entity_label, details)
  values
    (actor, 'pipeline_stage', nullif(payload ->> 'id', '')::uuid,
     lower(tg_op), stage_label, payload);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists pipeline_stages_audit on public.pipeline_stages;
create trigger pipeline_stages_audit after insert or update or delete on public.pipeline_stages
for each row execute function public.audit_pipeline_configuration();

alter table public.pipeline_stages enable row level security;
alter table public.pipeline_stage_aliases enable row level security;

drop policy if exists "Authenticated users can view pipeline stages" on public.pipeline_stages;
create policy "Authenticated users can view pipeline stages" on public.pipeline_stages
for select to anon, authenticated using (true);
drop policy if exists "Administrators can manage pipeline stages" on public.pipeline_stages;
create policy "Administrators can manage pipeline stages" on public.pipeline_stages
for all to authenticated using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

drop policy if exists "Authenticated users can view pipeline aliases" on public.pipeline_stage_aliases;
create policy "Authenticated users can view pipeline aliases" on public.pipeline_stage_aliases
for select to anon, authenticated using (true);
drop policy if exists "Administrators can manage pipeline aliases" on public.pipeline_stage_aliases;
create policy "Administrators can manage pipeline aliases" on public.pipeline_stage_aliases
for all to authenticated using (public.current_employee_is_administrator())
with check (public.current_employee_is_administrator());

insert into public.permission_definitions (key, name, description, category)
values ('pipeline.settings.manage', 'Manage pipeline settings', 'Create, rename, reorder, configure, and archive pipeline stages.', 'Administration')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (role_key, permission_key)
values ('administrator', 'pipeline.settings.manage')
on conflict do nothing;

commit;
