create table if not exists public.topic_resources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_topic_resources_topic
on public.topic_resources(topic_id, created_at desc);

alter table public.topic_resources enable row level security;

drop policy if exists "topic resources student select" on public.topic_resources;
drop policy if exists "topic resources admin all" on public.topic_resources;

create policy "topic resources student select"
on public.topic_resources for select to authenticated
using (public.has_platform_access());

create policy "topic resources admin all"
on public.topic_resources for all to authenticated
using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id, name, public)
values ('topic-resources', 'topic-resources', false)
on conflict (id) do update set public = false;

drop policy if exists "topic resources storage read" on storage.objects;
drop policy if exists "topic resources storage admin insert" on storage.objects;
drop policy if exists "topic resources storage admin update" on storage.objects;
drop policy if exists "topic resources storage admin delete" on storage.objects;

create policy "topic resources storage read"
on storage.objects for select to authenticated
using (bucket_id = 'topic-resources' and public.has_platform_access());

create policy "topic resources storage admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'topic-resources' and public.is_admin());

create policy "topic resources storage admin update"
on storage.objects for update to authenticated
using (bucket_id = 'topic-resources' and public.is_admin())
with check (bucket_id = 'topic-resources' and public.is_admin());

create policy "topic resources storage admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'topic-resources' and public.is_admin());
