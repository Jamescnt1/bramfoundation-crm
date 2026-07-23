begin;

drop policy if exists "Active employees can view pipeline stages"
  on public.pipeline_stages;
create policy "Active employees can view pipeline stages"
  on public.pipeline_stages
  for select
  to authenticated
  using (public.current_employee_is_active());

drop policy if exists "Active employees can view pipeline aliases"
  on public.pipeline_stage_aliases;
create policy "Active employees can view pipeline aliases"
  on public.pipeline_stage_aliases
  for select
  to authenticated
  using (public.current_employee_is_active());

commit;
