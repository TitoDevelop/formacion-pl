-- ALPHA FORMACION v0.2.7
-- Permite al panel admin borrar intentos al eliminar examenes oficiales erroneos.

drop policy if exists "attempts admin delete" on public.test_attempts;

create policy "attempts admin delete"
on public.test_attempts
for delete to authenticated
using (public.is_admin());
