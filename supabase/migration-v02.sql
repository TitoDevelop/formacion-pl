-- ALPHA FORMACIÓN · MIGRACIÓN V0.2
-- Ejecuta este archivo DESPUÉS de schema.sql.
-- No borra preguntas, exámenes ni intentos existentes.

-- 1. CONTROL DE ACCESO Y DATOS DE PERFIL
alter table public.profiles
  add column if not exists email text,
  add column if not exists access_enabled boolean not null default false;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- Los administradores existentes conservan acceso.
update public.profiles
set access_enabled = true
where role = 'ADMIN';

-- Actualiza el trigger de altas para guardar email y crear alumnos pendientes.
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

-- 2. PREGUNTAS MARCADAS PARA REPASO
create table if not exists public.user_review_questions (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create index if not exists idx_review_user_created
on public.user_review_questions(user_id, created_at desc);

-- 3. METADATOS DEL TEST
alter table public.test_attempts
  add column if not exists mode text not null default 'EXAM'
    check (mode in ('EXAM','PRACTICE')),
  add column if not exists title text,
  add column if not exists topic_ids uuid[];

-- 4. HELPERS DE SEGURIDAD
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

-- 5. RLS DE PROFILES
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles admin select" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;

create policy "profiles own select"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles admin select"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 6. CONTENIDO: SOLO USUARIOS CON ACCESO O ADMIN
drop policy if exists "content topics select" on public.topics;
drop policy if exists "content questions select" on public.questions;
drop policy if exists "content options select" on public.question_options;
drop policy if exists "content exams select" on public.official_exams;
drop policy if exists "content exam questions select" on public.official_exam_questions;

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

-- 7. INTENTOS: ADEMÁS DE SER PROPIOS, DEBEN TENER ACCESO
drop policy if exists "attempts own select" on public.test_attempts;
drop policy if exists "attempts own insert" on public.test_attempts;
drop policy if exists "attempts own update" on public.test_attempts;
drop policy if exists "answers own select" on public.test_attempt_answers;
drop policy if exists "answers own insert" on public.test_attempt_answers;

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

-- 8. MARCADAS PARA REPASO
alter table public.user_review_questions enable row level security;

drop policy if exists "review own select" on public.user_review_questions;
drop policy if exists "review own insert" on public.user_review_questions;
drop policy if exists "review own delete" on public.user_review_questions;

create policy "review own select"
on public.user_review_questions for select to authenticated
using (user_id = auth.uid() and public.has_platform_access());

create policy "review own insert"
on public.user_review_questions for insert to authenticated
with check (user_id = auth.uid() and public.has_platform_access());

create policy "review own delete"
on public.user_review_questions for delete to authenticated
using (user_id = auth.uid() and public.has_platform_access());

-- 9. OPCIONAL: crea algunos temas vacíos para empezar a clasificar.
-- Puedes cambiar sus nombres desde Supabase.
insert into public.topics(number, name)
values
  (1, 'Constitución Española'),
  (2, 'Organización territorial y Administración Local'),
  (3, 'Derecho Administrativo'),
  (4, 'Policía Local y Fuerzas y Cuerpos de Seguridad'),
  (5, 'Tráfico y Seguridad Vial'),
  (6, 'Derecho Penal y Procesal')
on conflict (number) do nothing;
