begin;

alter table public.job_material_scopes
  add column if not exists completion_check_method text not null default 'not_required',
  add column if not exists completion_check_status text not null default 'not_required',
  add column if not exists completion_contact_name text,
  add column if not exists completion_contact_method text,
  add column if not exists completion_check_notes text,
  add column if not exists completion_checked_at timestamptz,
  add column if not exists completion_checked_by uuid references public.employees(id) on delete set null;

alter table public.job_material_scopes
  drop constraint if exists job_material_scopes_completion_check_method_check,
  drop constraint if exists job_material_scopes_completion_check_status_check,
  drop constraint if exists job_material_scopes_completion_contact_method_check;

alter table public.job_material_scopes
  add constraint job_material_scopes_completion_check_method_check
    check (completion_check_method in ('job_walk', 'customer_checkin', 'not_required')),
  add constraint job_material_scopes_completion_check_status_check
    check (completion_check_status in ('pending', 'completed', 'issue', 'not_required')),
  add constraint job_material_scopes_completion_contact_method_check
    check (completion_contact_method is null or completion_contact_method in ('phone', 'email', 'text', 'in_person', 'other'));

update public.job_material_scopes
set completion_check_method = case when job_walk_required then 'job_walk' else 'not_required' end,
    completion_check_status = case when job_walk_required then 'pending' else 'not_required' end,
    completion_check_notes = case when job_walk_required then null else 'Not required under prior production workflow.' end
where completion_check_method = 'not_required'
  and completion_check_status = 'not_required';

create index if not exists job_material_scopes_completion_check_idx
  on public.job_material_scopes(job_id, completion_check_method, completion_check_status);

create or replace function public.handle_completion_check_issue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  related_customer_id uuid;
  related_salesperson text;
  related_employee_id uuid;
begin
  if new.completion_check_status = 'issue'
     and old.completion_check_status is distinct from new.completion_check_status then
    select customer_id, salesperson, assigned_employee_id
      into related_customer_id, related_salesperson, related_employee_id
    from public.jobs where id = new.job_id;
    perform public.run_crm_automations(
      'material_issue',
      coalesce(new.completion_check_notes, 'Customer reported an issue during completion check'),
      new.job_id, related_customer_id, related_salesperson,
      related_employee_id, gen_random_uuid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists job_material_scopes_completion_check_issue on public.job_material_scopes;
create trigger job_material_scopes_completion_check_issue
after update of completion_check_status on public.job_material_scopes
for each row execute function public.handle_completion_check_issue();

commit;
