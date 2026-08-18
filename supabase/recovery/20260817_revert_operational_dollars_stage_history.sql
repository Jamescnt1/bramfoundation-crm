begin;

drop trigger if exists jobs_record_billing_transition on public.jobs;
drop trigger if exists jobs_record_stage_transition on public.jobs;
drop function if exists public.record_job_billing_transition();
drop function if exists public.record_job_stage_transition();
drop table if exists public.job_stage_transitions;

commit;
