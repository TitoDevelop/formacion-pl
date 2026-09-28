-- v0.2.9 - Permite al panel admin eliminar usuarios completos.
-- Borra auth.users para que las tablas dependientes limpien por cascade.

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios.';
  end if;

  if target_user_id is null then
    raise exception 'Usuario no valido.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta.';
  end if;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'No existe ningun usuario con id %.', target_user_id;
  end if;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
