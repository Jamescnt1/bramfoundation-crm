create or replace function public.get_pipeline_stage_job_counts()
returns table (
  stage_slug text,
  job_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    stage.slug as stage_slug,
    count(job.id)::bigint as job_count
  from public.pipeline_stages as stage
  left join public.jobs as job
    on job.archived_at is null
   and (
     job.status = stage.slug
     or job.status = stage.label
     or exists (
       select 1
       from public.pipeline_stage_aliases as alias
       where alias.stage_slug = stage.slug
         and alias.alias = job.status
     )
   )
  group by stage.slug;
$$;

revoke all on function public.get_pipeline_stage_job_counts() from public;
grant execute on function public.get_pipeline_stage_job_counts() to authenticated;
