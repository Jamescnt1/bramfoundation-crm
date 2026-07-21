begin;

create or replace function public.audit_administration_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  row_id uuid;
  row_label text;
  before_data jsonb;
  after_data jsonb;
  row_data jsonb;
begin
  select id into actor_id
  from public.employees
  where auth_user_id = auth.uid()
  limit 1;

  before_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data := coalesce(after_data, before_data);
  row_id := (row_data ->> 'id')::uuid;
  row_label := case
    when tg_table_name = 'company_settings' then row_data ->> 'company_name'
    else row_data ->> 'name'
  end;

  insert into public.admin_audit_log (
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    entity_label,
    details
  ) values (
    actor_id,
    lower(tg_op),
    tg_table_name,
    row_id,
    row_label,
    jsonb_build_object(
      'before', before_data,
      'after', after_data
    )
  );

  return null;
end;
$$;

commit;
