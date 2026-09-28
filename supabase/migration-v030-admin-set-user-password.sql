-- v0.3.0 - Permite al panel admin establecer una nueva contrasena a un usuario.
-- Usa bcrypt via pgcrypto y no requiere flujo SMTP.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_user_password(
  target_user_id uuid,
  new_plain_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar contrasenas.';
  end if;

  if target_user_id is null then
    raise exception 'Usuario no valido.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propia contrasena desde este panel.';
  end if;

  if new_plain_password is null or length(new_plain_password) < 6 then
    raise exception 'La contrasena debe tener al menos 6 caracteres.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_plain_password, extensions.gen_salt('bf')),
      recovery_token = '',
      recovery_sent_at = null,
      email_change_token_current = '',
      email_change_token_new = '',
      email_change_sent_at = null,
      reauthentication_token = '',
      reauthentication_sent_at = null,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'No existe ningun usuario con id %.', target_user_id;
  end if;
end;
$$;

grant execute on function public.admin_set_user_password(uuid, text) to authenticated;
