begin;

alter table public.employees
  add column if not exists pipeline_card_size text not null default 'large';

alter table public.employees
  drop constraint if exists employees_pipeline_card_size_check;

alter table public.employees
  add constraint employees_pipeline_card_size_check
    check (pipeline_card_size in ('small', 'medium', 'large'));

commit;
