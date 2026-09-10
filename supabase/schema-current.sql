-- ALPHA FORMACION - SQL consolidado actual
-- Generado hasta v0.2.6.
-- Ejecutar desde Supabase > SQL Editor en una base nueva o para reconciliar estructura.

create extension if not exists pgcrypto;

-- TABLAS BASE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'STUDENT' check (role in ('STUDENT','ADMIN')),
  access_enabled boolean not null default false,
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
  mode text not null default 'EXAM' check (mode in ('EXAM','PRACTICE')),
  title text,
  topic_ids uuid[],
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  blank_answers integer not null default 0,
  answered_count integer,
  correct_count integer,
  wrong_count integer,
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

create table if not exists public.user_review_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create table if not exists public.user_resolved_failed_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  resolved_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create table if not exists public.test_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique(user_id, draft_key)
);

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

-- MIGRACIONES SOBRE BASES EXISTENTES
alter table public.profiles
  add column if not exists email text,
  add column if not exists access_enabled boolean not null default false;

alter table public.test_attempts
  add column if not exists mode text not null default 'EXAM' check (mode in ('EXAM','PRACTICE')),
  add column if not exists title text,
  add column if not exists topic_ids uuid[],
  add column if not exists duration_seconds integer,
  add column if not exists answered_count integer,
  add column if not exists correct_count integer,
  add column if not exists wrong_count integer;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

update public.profiles
set access_enabled = true
where role = 'ADMIN';

-- INDICES
create index if not exists idx_questions_topic on public.questions(topic_id);
create index if not exists idx_exams_municipality_year on public.official_exams(municipality, year);
create index if not exists idx_attempts_user_finished on public.test_attempts(user_id, finished_at desc);
create index if not exists idx_attempt_answers_attempt on public.test_attempt_answers(attempt_id);
create index if not exists idx_attempt_answers_question on public.test_attempt_answers(question_id);
create index if not exists idx_review_user_created on public.user_review_questions(user_id, created_at desc);
create index if not exists idx_resolved_failed_user_question on public.user_resolved_failed_questions(user_id, question_id);
create index if not exists idx_test_drafts_user_updated on public.test_drafts(user_id, updated_at desc);
create index if not exists idx_topic_resources_topic on public.topic_resources(topic_id, created_at desc);

-- FUNCIONES Y TRIGGERS
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name, role, access_enabled)
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    'STUDENT',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name,''), public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

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

create or replace function public.has_platform_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (access_enabled = true or role = 'ADMIN')
  );
$$;

-- ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.official_exams enable row level security;
alter table public.official_exam_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_attempt_answers enable row level security;
alter table public.user_review_questions enable row level security;
alter table public.user_resolved_failed_questions enable row level security;
alter table public.test_drafts enable row level security;
alter table public.topic_resources enable row level security;

drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles admin select" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
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
drop policy if exists "attempts admin select" on public.test_attempts;
drop policy if exists "answers own select" on public.test_attempt_answers;
drop policy if exists "answers own insert" on public.test_attempt_answers;
drop policy if exists "review own select" on public.user_review_questions;
drop policy if exists "review own insert" on public.user_review_questions;
drop policy if exists "review own delete" on public.user_review_questions;
drop policy if exists "resolved failed own select" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own insert" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own update" on public.user_resolved_failed_questions;
drop policy if exists "resolved failed own delete" on public.user_resolved_failed_questions;
drop policy if exists "test drafts own select" on public.test_drafts;
drop policy if exists "test drafts own insert" on public.test_drafts;
drop policy if exists "test drafts own update" on public.test_drafts;
drop policy if exists "test drafts own delete" on public.test_drafts;
drop policy if exists "topic resources student select" on public.topic_resources;
drop policy if exists "topic resources admin all" on public.topic_resources;

create policy "profiles own select"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "profiles admin select"
on public.profiles for select to authenticated
using (public.is_admin());

create policy "profiles admin update"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "content topics select"
on public.topics for select to authenticated
using (public.has_platform_access());

create policy "content questions select"
on public.questions for select to authenticated
using (public.has_platform_access());

create policy "content options select"
on public.question_options for select to authenticated
using (public.has_platform_access());

create policy "content exams select"
on public.official_exams for select to authenticated
using (public.has_platform_access() and (active = true or public.is_admin()));

create policy "content exam questions select"
on public.official_exam_questions for select to authenticated
using (public.has_platform_access());

create policy "admin topics all"
on public.topics for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "admin questions all"
on public.questions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "admin options all"
on public.question_options for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "admin exams all"
on public.official_exams for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "admin exam questions all"
on public.official_exam_questions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "attempts own select"
on public.test_attempts for select to authenticated
using (user_id = auth.uid() and public.has_platform_access());

create policy "attempts own insert"
on public.test_attempts for insert to authenticated
with check (user_id = auth.uid() and public.has_platform_access());

create policy "attempts own update"
on public.test_attempts for update to authenticated
using (user_id = auth.uid() and public.has_platform_access())
with check (user_id = auth.uid() and public.has_platform_access());

create policy "attempts admin select"
on public.test_attempts for select to authenticated
using (public.is_admin());

create policy "answers own select"
on public.test_attempt_answers for select to authenticated
using (
  public.has_platform_access()
  and exists (
    select 1 from public.test_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  )
);

create policy "answers own insert"
on public.test_attempt_answers for insert to authenticated
with check (
  public.has_platform_access()
  and exists (
    select 1 from public.test_attempts a
    where a.id = attempt_id and a.user_id = auth.uid()
  )
);

create policy "review own select"
on public.user_review_questions for select to authenticated
using (user_id = auth.uid() and public.has_platform_access());

create policy "review own insert"
on public.user_review_questions for insert to authenticated
with check (user_id = auth.uid() and public.has_platform_access());

create policy "review own delete"
on public.user_review_questions for delete to authenticated
using (user_id = auth.uid() and public.has_platform_access());

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

create policy "topic resources student select"
on public.topic_resources for select to authenticated
using (public.has_platform_access());

create policy "topic resources admin all"
on public.topic_resources for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- STORAGE PARA RECURSOS DE TEMAS
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

-- DATOS INICIALES OPCIONALES
insert into public.topics(number, name)
values
  (1, 'Constitucion Espanola'),
  (2, 'Organizacion territorial y Administracion Local'),
  (3, 'Derecho Administrativo'),
  (4, 'Policia Local y Fuerzas y Cuerpos de Seguridad'),
  (5, 'Trafico y Seguridad Vial'),
  (6, 'Derecho Penal y Procesal')
on conflict (number) do nothing;

-- PLANTILLA PARA NOMBRAR UN ADMIN
-- Cambia TU_EMAIL por el correo registrado que quieras convertir en administrador.
-- update public.profiles
-- set role = 'ADMIN', access_enabled = true
-- where id = (select id from auth.users where email = 'TU_EMAIL');
