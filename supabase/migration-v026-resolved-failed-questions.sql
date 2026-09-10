create table if not exists public.user_resolved_failed_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  resolved_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists idx_resolved_failed_user_question
on public.user_resolved_failed_questions(user_id, question_id);

alter table public.user_resolved_failed_questions enable row level security;

drop policy if exists "resolved failed own select" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own insert" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own update" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own delete" on public.user_resolved_failed_questions;

create policy "resolved failed own select"
on public.user_resolved_failed_questions for select to authenticated
using (user_id = auth.uid() and public.has_platform_access());

create policy "resolved failed own insert"
on public.user_resolved_failed_questions for insert to authenticated
with check (user_id = auth.uid() and public.has_platform_access());

create policy "resolved failed own update"
on public.user_resolved_failed_questions for update to authenticated
using (user_id = auth.uid() and public.has_platform_access())
with check (user_id = auth.uid() and public.has_platform_access());

create policy "resolved failed own delete"
on public.user_resolved_failed_questions for delete to authenticated
using (user_id = auth.uid() and public.has_platform_access());
