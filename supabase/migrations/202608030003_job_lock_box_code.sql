begin;

alter table public.jobs
  add column if not exists lock_box_code text;

commit;
