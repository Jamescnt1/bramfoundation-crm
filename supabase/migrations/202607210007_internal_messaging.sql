begin;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null check (conversation_type in ('internal_direct', 'internal_job', 'internal_group')),
  title text,
  job_id uuid references public.jobs(id) on delete cascade,
  created_by_employee_id uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  archived_at timestamptz,
  constraint conversations_job_type_check check (
    (conversation_type = 'internal_job' and job_id is not null)
    or (conversation_type <> 'internal_job' and job_id is null)
  )
);

create unique index if not exists conversations_one_active_job_thread_idx
  on public.conversations(job_id)
  where conversation_type = 'internal_job' and archived_at is null;
create index if not exists conversations_last_message_idx
  on public.conversations(last_message_at desc nulls last);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, employee_id)
);
create index if not exists conversation_participants_employee_idx
  on public.conversation_participants(employee_id, conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_employee_id uuid not null references public.employees(id) on delete restrict,
  channel text not null default 'internal' check (channel = 'internal'),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

create table if not exists public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (message_id, employee_id)
);
create index if not exists message_mentions_employee_unread_idx
  on public.message_mentions(employee_id, created_at desc) where read_at is null;

create table if not exists public.message_attachments (
  message_id uuid not null references public.messages(id) on delete cascade,
  attachment_id uuid not null references public.job_attachments(id) on delete cascade,
  primary key (message_id, attachment_id)
);

create table if not exists public.message_task_links (
  message_id uuid primary key references public.messages(id) on delete cascade,
  task_id uuid not null unique references public.job_tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  notification_type text not null check (notification_type in ('message', 'mention')),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (employee_id, notification_type, message_id)
);
create index if not exists employee_notifications_unread_idx
  on public.employee_notifications(employee_id, created_at desc) where read_at is null;

alter table public.job_tasks
  add column if not exists source_message_id uuid references public.messages(id) on delete set null;
create index if not exists job_tasks_source_message_idx on public.job_tasks(source_message_id);

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees
  where auth_user_id = auth.uid() and active = true
  limit 1
$$;

create or replace function public.employee_can_access_job(target_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees employee
    join public.jobs job on job.id = target_job_id and job.archived_at is null
    where employee.auth_user_id = auth.uid() and employee.active = true
      and (
        employee.role in ('administrator', 'sales_manager', 'operations_manager', 'office_staff')
        or job.assigned_employee_id = employee.id
        or lower(coalesce(job.salesperson, '')) = lower(employee.name)
      )
  )
$$;

create or replace function public.employee_can_access_conversation(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations conversation
    where conversation.id = target_conversation_id
      and conversation.archived_at is null
      and (
        (conversation.conversation_type = 'internal_job' and public.employee_can_access_job(conversation.job_id))
        or exists (
          select 1 from public.conversation_participants participant
          where participant.conversation_id = conversation.id
            and participant.employee_id = public.current_employee_id()
        )
      )
  )
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_mentions enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_task_links enable row level security;
alter table public.employee_notifications enable row level security;

create policy "Employees can view authorized internal conversations" on public.conversations
for select to authenticated using (public.employee_can_access_conversation(id));
create policy "Employees can view authorized participants" on public.conversation_participants
for select to authenticated using (public.employee_can_access_conversation(conversation_id));
create policy "Employees can update their read state" on public.conversation_participants
for update to authenticated using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());
create policy "Employees can view authorized internal messages" on public.messages
for select to authenticated using (channel = 'internal' and public.employee_can_access_conversation(conversation_id));
create policy "Employees can view their mentions" on public.message_mentions
for select to authenticated using (employee_id = public.current_employee_id());
create policy "Employees can view authorized message attachments" on public.message_attachments
for select to authenticated using (
  exists (select 1 from public.messages message where message.id = message_id and public.employee_can_access_conversation(message.conversation_id))
);
create policy "Employees can view authorized task links" on public.message_task_links
for select to authenticated using (
  exists (select 1 from public.messages message where message.id = message_id and public.employee_can_access_conversation(message.conversation_id))
);
create policy "Employees can view their notifications" on public.employee_notifications
for select to authenticated using (employee_id = public.current_employee_id());
create policy "Employees can update their notifications" on public.employee_notifications
for update to authenticated using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

commit;
