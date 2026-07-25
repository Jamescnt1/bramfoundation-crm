begin;

alter table public.job_layouts
  add column if not exists attachment_id uuid references public.job_attachments(id) on delete set null,
  add column if not exists room_or_area text,
  add column if not exists notes text,
  add column if not exists record_kind text not null default 'legacy_drawing',
  add column if not exists version_number integer not null default 1,
  add column if not exists supersedes_layout_id uuid references public.job_layouts(id) on delete set null,
  add column if not exists is_latest boolean not null default true;

alter table public.job_layouts
  drop constraint if exists job_layouts_record_kind_check,
  add constraint job_layouts_record_kind_check
    check (record_kind in ('legacy_drawing', 'imported_file')),
  drop constraint if exists job_layouts_version_number_check,
  add constraint job_layouts_version_number_check
    check (version_number >= 1),
  drop constraint if exists job_layouts_room_or_area_check,
  add constraint job_layouts_room_or_area_check
    check (room_or_area is null or char_length(room_or_area) <= 120);

create unique index if not exists job_layouts_attachment_unique_idx
  on public.job_layouts(attachment_id)
  where attachment_id is not null;

create index if not exists job_layouts_latest_job_updated_idx
  on public.job_layouts(job_id, is_latest, updated_at desc)
  where archived_at is null;

update public.permission_definitions
set
  name = case key
    when 'layouts.view' then 'View job layouts'
    when 'layouts.manage' then 'Import and manage job layouts'
    else name
  end,
  description = case key
    when 'layouts.view' then 'View imported layouts and legacy drawing previews for accessible jobs.'
    when 'layouts.manage' then 'Import, rename, replace, and organize job layout documents.'
    else description
  end
where key in ('layouts.view', 'layouts.manage');

commit;
