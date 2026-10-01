-- v0.3.3 - Avisos de errores en preguntas.

create table if not exists public.question_issue_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_question_issue_reports_status_created
on public.question_issue_reports(status, created_at desc);

create index if not exists idx_question_issue_reports_question
on public.question_issue_reports(question_id);

create unique index if not exists idx_question_issue_reports_open_once
on public.question_issue_reports(user_id, question_id)
where status = 'OPEN';

alter table public.question_issue_reports enable row level security;

drop policy if exists "question issues own select" on public.question_issue_reports;
drop policy if exists "question issues own insert" on public.question_issue_reports;
drop policy if exists "question issues admin select" on public.question_issue_reports;
drop policy if exists "question issues admin update" on public.question_issue_reports;
drop policy if exists "question issues admin delete" on public.question_issue_reports;

create policy "question issues own select"
on public.question_issue_reports for select to authenticated
using (user_id = auth.uid());

create policy "question issues own insert"
on public.question_issue_reports for insert to authenticated
with check (
  user_id = auth.uid()
  and public.has_platform_access()
  and length(btrim(message)) >= 5
);

create policy "question issues admin select"
on public.question_issue_reports for select to authenticated
using (public.is_admin());

create policy "question issues admin update"
on public.question_issue_reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "question issues admin delete"
on public.question_issue_reports for delete to authenticated
using (public.is_admin());
