begin;

insert into public.material_categories
  (name, abbreviation, color_key, ordering_required, installation_required, work_order_required, sort_order)
values ('Demo / Labor', 'D', 'gray', false, true, true, 90)
on conflict do nothing;

alter table public.job_material_scopes
  add column if not exists scope_kind text not null default 'material',
  add column if not exists job_walk_required boolean not null default false;

alter table public.job_material_scopes
  drop constraint if exists job_material_scopes_scope_kind_check;
alter table public.job_material_scopes
  add constraint job_material_scopes_scope_kind_check
  check (scope_kind in ('material', 'demo', 'labor'));

update public.job_material_scopes scopes
set scope_kind = 'demo', ordering_required = false
from public.material_categories categories
where categories.id = scopes.material_category_id
  and categories.name = 'Demo / Labor';

commit;
