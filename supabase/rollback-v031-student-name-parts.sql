-- Rollback v0.3.1 - Quita nombre/apellidos separados y restaura el trigger anterior.
-- Ejecutar solo si necesitas deshacer migration-v031-student-name-parts.sql.

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

alter table public.profiles
  drop column if exists first_name,
  drop column if exists last_name_1,
  drop column if exists last_name_2;
