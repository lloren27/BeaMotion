-- BeaMotion: lectura administrativa necesaria para client_overview (RPC v3).
-- Las tres tablas deben tener RLS activo. No modifica datos ni permisos de escritura.

begin;

do $$
begin
  if (
    select count(*)
    from pg_catalog.pg_class
    where oid in (
      'public.client_notes'::regclass,
      'public.form_submissions'::regclass,
      'public.client_journal'::regclass
    )
      and relrowsecurity
  ) <> 3 then
    raise exception 'RLS must be enabled on client_notes, form_submissions and client_journal';
  end if;
end;
$$;

-- El permiso de tabla permite consultar; la política restringe las filas a admins.
grant select on table public.client_notes to authenticated;

create policy beamotion_admin_read
  on public.client_notes
  for select to authenticated
  using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

create policy beamotion_admin_read
  on public.form_submissions
  for select to authenticated
  using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

-- Se conserva la política existente que permite leer el diario propio.
create policy beamotion_admin_read
  on public.client_journal
  for select to authenticated
  using ((select private.has_role(auth.uid(), 'admin'::public.app_role)));

commit;
