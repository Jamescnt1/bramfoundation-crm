begin;

-- Foundation CRM still has shared read paths that use the public Supabase
-- client. Pipeline configuration is non-sensitive, while all writes remain
-- protected by the administrator-only policies created in the prior migration.
drop policy if exists "Authenticated users can view pipeline stages"
  on public.pipeline_stages;
create policy "Pipeline configuration is readable"
  on public.pipeline_stages
  for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can view pipeline aliases"
  on public.pipeline_stage_aliases;
create policy "Pipeline aliases are readable"
  on public.pipeline_stage_aliases
  for select to anon, authenticated
  using (true);

commit;
