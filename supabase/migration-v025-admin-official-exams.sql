-- ALPHA FORMACION v0.2.5
-- Permite al panel admin contar intentos de examenes oficiales.

drop policy if exists "attempts admin select" on public.test_attempts;

create policy "attempts admin select"
on public.test_attempts
for select to authenticated
using (public.is_admin());
