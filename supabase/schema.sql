-- ALPHA FORMACIÓN v0.1
-- Ejecuta este fichero una vez desde Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'STUDENT' check (role in ('STUDENT','ADMIN')),
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  number integer,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(number)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  statement text not null,
  explanation text,
  topic_id uuid references public.topics(id) on delete set null,
  official boolean not null default false,
  source_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text text not null,
  position smallint not null check (position between 1 and 4),
  is_correct boolean not null default false,
  unique(question_id, position)
);

create table if not exists public.official_exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text not null,
  year integer not null,
  call_name text,
  source_key text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.official_exam_questions (
  exam_id uuid not null references public.official_exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_number text,
  position integer not null,
  primary key(exam_id, question_id),
  unique(exam_id, position)
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references public.official_exams(id) on delete set null,
  attempt_type text not null default 'OFFICIAL' check (attempt_type in ('OFFICIAL','TOPIC','MISTAKES','CUSTOM')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  blank_answers integer not null default 0,
  score numeric(5,2)
);

create table if not exists public.test_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.question_options(id) on delete set null,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create index if not exists idx_questions_topic on public.questions(topic_id);
create index if not exists idx_exams_municipality_year on public.official_exams(municipality, year);
create index if not exists idx_attempts_user_finished on public.test_attempts(user_id, finished_at desc);
create index if not exists idx_attempt_answers_attempt on public.test_attempt_answers(attempt_id);
create index if not exists idx_attempt_answers_question on public.test_attempt_answers(question_id);

-- Perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'STUDENT')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper de seguridad
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.official_exams enable row level security;
alter table public.official_exam_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_attempt_answers enable row level security;

-- Limpiar políticas si vuelves a ejecutar
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles admin select" on public.profiles;
drop policy if exists "content topics select" on public.topics;
drop policy if exists "content questions select" on public.questions;
drop policy if exists "content options select" on public.question_options;
drop policy if exists "content exams select" on public.official_exams;
drop policy if exists "content exam questions select" on public.official_exam_questions;
drop policy if exists "admin topics all" on public.topics;
drop policy if exists "admin questions all" on public.questions;
drop policy if exists "admin options all" on public.question_options;
drop policy if exists "admin exams all" on public.official_exams;
drop policy if exists "admin exam questions all" on public.official_exam_questions;
drop policy if exists "attempts own select" on public.test_attempts;
drop policy if exists "attempts own insert" on public.test_attempts;
drop policy if exists "attempts own update" on public.test_attempts;
drop policy if exists "answers own select" on public.test_attempt_answers;
drop policy if exists "answers own insert" on public.test_attempt_answers;

create policy "profiles own select" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "profiles admin select" on public.profiles
for select to authenticated using (public.is_admin());

create policy "content topics select" on public.topics
for select to authenticated using (true);
create policy "content questions select" on public.questions
for select to authenticated using (true);
create policy "content options select" on public.question_options
for select to authenticated using (true);
create policy "content exams select" on public.official_exams
for select to authenticated using (active = true or public.is_admin());
create policy "content exam questions select" on public.official_exam_questions
for select to authenticated using (true);

create policy "admin topics all" on public.topics
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin questions all" on public.questions
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin options all" on public.question_options
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin exams all" on public.official_exams
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin exam questions all" on public.official_exam_questions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "attempts own select" on public.test_attempts
for select to authenticated using (user_id = auth.uid());
create policy "attempts own insert" on public.test_attempts
for insert to authenticated with check (user_id = auth.uid());
create policy "attempts own update" on public.test_attempts
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "answers own select" on public.test_attempt_answers
for select to authenticated using (
  exists (
    select 1 from public.test_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  )
);
create policy "answers own insert" on public.test_attempt_answers
for insert to authenticated with check (
  exists (
    select 1 from public.test_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  )
);
