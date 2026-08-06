begin;

-- Billed Jobs is a closed pipeline stage. Preserve the job and its reporting
-- history, but remove it from the active pipeline after the retention window.
update public.pipeline_stages
set terminal = true,
    updated_at = now()
where slug in ('billed', 'billed_jobs')
   or lower(btrim(label)) in ('billed', 'billed jobs');

create or replace function public.pipeline_stage_is_closed(stage_status text)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.pipeline_stages stages
    where (
      lower(stages.slug) = lower(stage_status)
      or lower(stages.label) = lower(stage_status)
      or stages.slug = (
        select aliases.stage_slug from public.pipeline_stage_aliases aliases
        where lower(aliases.alias) = lower(stage_status) limit 1
      )
    )
    and (
      lower(stages.slug) in ('lost', 'billed', 'billed_jobs')
      or lower(btrim(stages.label)) in ('lost', 'billed', 'billed jobs')
    )
  );
$$;

update public.jobs
set pipeline_terminal_entered_at = coalesce(pipeline_terminal_entered_at, updated_at, created_at),
    pipeline_hide_after = coalesce(pipeline_hide_after, updated_at, created_at) + interval '30 days'
where archived_at is null
  and public.pipeline_stage_is_closed(status)
  and pipeline_hide_after is null;

commit;
