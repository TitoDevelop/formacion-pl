-- Reset de progreso/datos de uso de un usuario.
--
-- Uso:
-- 1. Cambia target_email por el email del alumno.
-- 2. Ejecuta en Supabase > SQL Editor.
--
-- Esto NO borra la cuenta de auth.users ni el perfil public.profiles.
-- Borra:
-- - intentos de test y respuestas asociadas;
-- - borradores de test;
-- - preguntas marcadas para repasar;
-- - preguntas falladas marcadas como resueltas.

do $$
declare
  target_email text := 'ALUMNO@EMAIL.COM';
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No existe ningun usuario con email %', target_email;
  end if;

  -- Borra respuestas mediante cascade al borrar test_attempts.
  delete from public.test_attempts
  where user_id = target_user_id;

  delete from public.test_drafts
  where user_id = target_user_id;

  delete from public.user_review_questions
  where user_id = target_user_id;

  if to_regclass('public.user_resolved_failed_questions') is not null then
    delete from public.user_resolved_failed_questions
    where user_id = target_user_id;
  end if;

  raise notice 'Reset completado para % (%)', target_email, target_user_id;
end $$;

-- Opcional: si tambien quieres quitarle el acceso a la plataforma, ejecuta aparte:
--
-- update public.profiles
-- set access_enabled = false
-- where id = (
--   select id from auth.users where lower(email) = lower('ALUMNO@EMAIL.COM') limit 1
-- );

