-- Ejecutar en SQL Editor del Supabase PROPIO DE ENTRENAMIENTOS.
-- Sustituir CORREO_ADMIN por el correo de acceso de la entrenadora.
-- Concede acceso administrativo a TODOS los entrenamientos.
-- La cuenta debe existir en Auth con email confirmado y la misma contraseña
-- que en Lovable. No crea usuarios ni cambia contraseñas.
do $$
declare
  admin_email text := lower(btrim('CORREO_ADMIN'));
  admin_user auth.users%rowtype;
  matches integer;
begin
  if admin_email = 'correo_admin' or admin_email = '' then
    raise exception 'Sustituye el marcador por el correo de acceso de la entrenadora.';
  end if;

  select count(*) into matches from auth.users where lower(email) = admin_email;
  if matches = 0 then
    raise exception 'La cuenta no existe en Auth de entrenamientos. Créala desde Authentication > Users con el mismo correo y contraseña de Lovable, confirma el email y repite el script.';
  elsif matches <> 1 then
    raise exception 'Hay varias cuentas con ese correo. Revisa Auth antes de conceder permisos.';
  end if;

  select * into strict admin_user from auth.users where lower(email) = admin_email;
  if admin_user.email_confirmed_at is null then
    raise exception 'El email de la cuenta no está confirmado. Confírmalo en Auth y repite el script.';
  end if;
  if admin_user.banned_until > now() then
    raise exception 'La cuenta está bloqueada en Auth. Revisa el bloqueo antes de conceder permisos.';
  end if;

  insert into public.training_admins (user_id) values (admin_user.id)
    on conflict (user_id) do nothing;
  raise notice 'Permiso de entrenamientos preparado. Cierra sesión en la app y vuelve a entrar. Si falla, comprueba que la contraseña coincide en ambos proyectos.';
end;
$$;
