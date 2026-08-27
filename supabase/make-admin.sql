-- 1) Regístrate primero desde la web.
-- 2) Cambia TU_EMAIL por tu correo.
-- 3) Ejecuta este SQL desde Supabase > SQL Editor.

update public.profiles
set role = 'ADMIN'
where id = (
  select id from auth.users where email = 'TU_EMAIL'
);

select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'TU_EMAIL';
