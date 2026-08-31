create table if not exists public.test_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique(user_id, draft_key)
);

create index if not exists idx_test_drafts_user_updated
on public.test_drafts(user_id, updated_at desc);

alter table public.test_drafts enable row level security;

drop policy if exists "test drafts own select" on public.test_drafts;
drop policy if exists "test drafts own insert" on public.test_drafts;
drop policy if exists "test drafts own update" on public.test_drafts;
drop policy if exists "test drafts own delete" on public.test_drafts;

create policy "test drafts own select"
on public.test_drafts for select to authenticated
using (user_id = auth.uid() and public.has_platform_access());

create policy "test drafts own insert"
on public.test_drafts for insert to authenticated
with check (user_id = auth.uid() and public.has_platform_access());

create policy "test drafts own update"
on public.test_drafts for update to authenticated
using (user_id = auth.uid() and public.has_platform_access())
with check (user_id = auth.uid() and public.has_platform_access());

create policy "test drafts own delete"
on public.test_drafts for delete to authenticated
using (user_id = auth.uid() and public.has_platform_access());
