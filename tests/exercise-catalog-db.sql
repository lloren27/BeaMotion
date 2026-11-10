\set ON_ERROR_STOP on
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.training_admins (user_id) values ('00000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.exercise_catalog (id, name, description, patterns, band_color, weight_kg)
values ('10000000-0000-0000-0000-000000000001', 'Zancada', 'Instrucciones', array['core','empuje superior'], 'roja', 8);
insert into public.training_monthly_plans (id, client_id, period_month, session_count)
values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-11-01', 4);
insert into public.training_sessions (id, plan_id, session_number, model_code)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'C'),
       ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'C');
select public.add_catalog_exercise_to_session('40000000-0000-0000-0000-000000000001', 0::smallint, '10000000-0000-0000-0000-000000000001');
select public.add_catalog_exercise_to_session('40000000-0000-0000-0000-000000000002', 0::smallint, '10000000-0000-0000-0000-000000000001');
update public.exercise_catalog set name = 'Editado', description = 'Nueva descripción', weight_kg = 20, archived = true where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.training_exercises where name = 'Zancada' and notes = 'Instrucciones' and catalog_snapshot->>'weight_kg' = '8') <> 2 then raise exception 'Las sesiones no conservan la copia'; end if;
  if (select count(*) from public.training_sets where load = '8 kg · Goma roja' and actual_load is null) <> 2 then raise exception 'La carga copiada no es correcta'; end if;
  begin
    perform public.add_catalog_exercise_to_session('40000000-0000-0000-0000-000000000001', 1::smallint, '10000000-0000-0000-0000-000000000001');
    raise exception 'Se ha permitido añadir un ejercicio archivado';
  exception when no_data_found then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.exercise_catalog) <> 0 then raise exception 'RLS permite leer el catálogo'; end if;
  begin
    insert into public.exercise_catalog (name) values ('No autorizado');
    raise exception 'RLS permite escribir en el catálogo';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
