alter table public.employees
  add column if not exists pipeline_sort_order text not null default 'newest';

alter table public.employees
  drop constraint if exists employees_pipeline_sort_order_check;

alter table public.employees
  add constraint employees_pipeline_sort_order_check
    check (pipeline_sort_order in ('newest', 'oldest', 'alphabetical'));
