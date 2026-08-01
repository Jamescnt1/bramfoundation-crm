begin;

-- Emergency recovery only. Prefer disabling the feature in application
-- settings so production records remain visible and auditable.
update public.pipeline_stages
set active = true
where slug in ('materials_ordered', 'install_scheduled', 'work_order_sent');

update public.pipeline_stages
set active = false
where slug = 'in_progress';

update public.jobs jobs
set status = coalesce(
  jobs.legacy_production_status,
  case
    when exists (
      select 1 from public.appointments appointments
      where appointments.job_id = jobs.id
        and appointments.appointment_type = 'installation'
        and appointments.status <> 'cancelled'
        and appointments.work_order_status in ('sent','acknowledged')
    ) then 'work_order_sent'
    when exists (
      select 1 from public.appointments appointments
      where appointments.job_id = jobs.id
        and appointments.appointment_type = 'installation'
        and appointments.status <> 'cancelled'
    ) then 'install_scheduled'
    when exists (
      select 1 from public.job_material_scopes scopes
      where scopes.job_id = jobs.id
        and scopes.material_status in ('ordered','partially_received','ready')
    ) then 'materials_ordered'
    else 'approved'
  end
)
where jobs.status = 'in_progress';

update public.automation_rules
set active = false
where trigger_event in (
  'material_ordered', 'material_ready', 'all_materials_ordered',
  'all_materials_ready', 'work_order_sent', 'all_work_orders_sent'
)
or (trigger_event = 'job_status_changed' and trigger_value = 'in_progress');

update public.production_workflow_settings set enabled = false where singleton;

commit;
