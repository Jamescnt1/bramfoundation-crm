begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-attachments',
  'job-attachments',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  uploaded_by_employee_id uuid references public.employees(id) on delete set null,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  attachment_kind text not null check (attachment_kind in ('photo', 'file')),
  category text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by_employee_id uuid references public.employees(id) on delete set null
);

create index if not exists job_attachments_job_kind_created_idx
  on public.job_attachments(job_id, attachment_kind, created_at desc)
  where archived_at is null;
create index if not exists job_attachments_uploader_idx
  on public.job_attachments(uploaded_by_employee_id);
create index if not exists job_attachments_archived_idx
  on public.job_attachments(job_id, archived_at)
  where archived_at is not null;

create or replace function public.set_job_attachment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists job_attachments_set_updated_at on public.job_attachments;
create trigger job_attachments_set_updated_at
before update on public.job_attachments
for each row execute function public.set_job_attachment_updated_at();

insert into public.permission_definitions (key, name, description, category) values
  ('attachments.view', 'View job attachments', 'View and download files and photos for accessible jobs.', 'Jobs'),
  ('attachments.manage', 'Manage job attachments', 'Upload files and photos and edit their metadata.', 'Jobs'),
  ('attachments.archive', 'Archive job attachments', 'Archive files and photos while preserving history.', 'Destructive actions')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from (values
  ('administrator', 'attachments.view'), ('administrator', 'attachments.manage'), ('administrator', 'attachments.archive'),
  ('sales_manager', 'attachments.view'), ('sales_manager', 'attachments.manage'), ('sales_manager', 'attachments.archive'),
  ('salesperson', 'attachments.view'), ('salesperson', 'attachments.manage'),
  ('operations_manager', 'attachments.view'), ('operations_manager', 'attachments.manage'), ('operations_manager', 'attachments.archive'),
  ('installer', 'attachments.view'), ('installer', 'attachments.manage'),
  ('office_staff', 'attachments.view'), ('office_staff', 'attachments.manage')
) as permissions(role_key, permission_key)
on conflict do nothing;

alter table public.job_attachments enable row level security;

drop policy if exists "Employees can view active job attachments" on public.job_attachments;
create policy "Employees can view active job attachments"
on public.job_attachments for select to authenticated
using (
  archived_at is null
  and exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active = true
  )
);

drop policy if exists "Attachment managers can insert metadata" on public.job_attachments;
create policy "Attachment managers can insert metadata"
on public.job_attachments for insert to authenticated
with check (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'attachments.manage'
      and e.id = uploaded_by_employee_id
  )
);

drop policy if exists "Attachment managers can update metadata" on public.job_attachments;
create policy "Attachment managers can update metadata"
on public.job_attachments for update to authenticated
using (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('attachments.manage', 'attachments.archive')
  )
)
with check (
  exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key in ('attachments.manage', 'attachments.archive')
  )
);

-- The application uses authenticated server endpoints for storage operations.
-- These policies provide defense in depth and prevent cross-job path access.
drop policy if exists "Employees can read job attachment objects" on storage.objects;
create policy "Employees can read job attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'job-attachments'
  and exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and active = true
  )
  and exists (
    select 1 from public.jobs
    where id::text = (storage.foldername(name))[1]
      and archived_at is null
  )
);

drop policy if exists "Attachment managers can upload job objects" on storage.objects;
create policy "Attachment managers can upload job objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-attachments'
  and exists (
    select 1
    from public.employees e
    join public.role_permissions rp on rp.role_key = e.role
    where e.auth_user_id = auth.uid() and e.active = true
      and rp.permission_key = 'attachments.manage'
  )
  and exists (
    select 1 from public.jobs
    where id::text = (storage.foldername(name))[1]
      and archived_at is null
  )
);

commit;
