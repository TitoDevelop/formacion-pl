-- v0.3.1 - Guarda nombre y dos apellidos sin bloquear usuarios existentes.
-- Las columnas son nullable para que los alumnos antiguos puedan seguir entrando.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name_1 text,
  add column if not exists last_name_2 text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(
    id,
    email,
    full_name,
    first_name,
    last_name_1,
    last_name_2,
    role,
    access_enabled
  )
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'first_name',''),
    nullif(new.raw_user_meta_data->>'last_name_1',''),
    nullif(new.raw_user_meta_data->>'last_name_2',''),
    'STUDENT',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name,''), public.profiles.full_name),
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name_1 = coalesce(excluded.last_name_1, public.profiles.last_name_1),
        last_name_2 = coalesce(excluded.last_name_2, public.profiles.last_name_2);
  return new;
end;
$$;
