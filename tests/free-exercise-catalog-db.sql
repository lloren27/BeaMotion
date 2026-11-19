\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000081'), ('00000000-0000-0000-0000-000000000082');
insert into public.training_admins(user_id) values ('00000000-0000-0000-0000-000000000081');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', true);
select public.create_monthly_models('2026-11-01', false);
do $$
declare mid uuid; rev integer; before_count integer; eid uuid; sid uuid; pid uuid; cid uuid;
begin
 select id into mid from public.monthly_training_models where period_month='2026-11-01' and week_number=3 and model_code='A';
 rev := public.save_monthly_model_draft(mid, 0, '[{"name":"  Plancha libre  ","description":"Mantener alineación","patterns":["core"],"material":"Esterilla","adaptation":"Apoyar rodillas"}]');
 if not exists(select 1 from public.exercise_catalog where name='Plancha libre' and description='Mantener alineación' and patterns=array['core'] and notes like '%Esterilla%') then
   raise exception 'El ejercicio libre del modelo no llegó a la biblioteca';
 end if;
 select count(*) into before_count from public.exercise_catalog;
 perform public.save_monthly_model_draft(mid, rev, '[{"name":"PLANCHA   LIBRE","description":"Otra instrucción","patterns":["core"]}]');
 if (select count(*) from public.exercise_catalog) <> before_count then raise exception 'Guardar de nuevo duplica el ejercicio'; end if;
 if not exists(select 1 from public.exercise_catalog where name='Plancha libre' and description='Mantener alineación') then raise exception 'Se sobrescribió la ficha existente'; end if;
 begin
   perform public.save_monthly_model_draft(mid, 0, '[{"name":"No debe existir","patterns":["core"]}]');
   raise exception 'Se aceptó revisión obsoleta';
 exception when serialization_failure then null; end;
 if exists(select 1 from public.exercise_catalog where name='No debe existir') then raise exception 'Guardado fallido dejó ficha huérfana'; end if;
 insert into public.training_monthly_plans(client_id,period_month,session_count) values(gen_random_uuid(),'2026-11-01',4) returning id into pid;
 insert into public.training_sessions(plan_id,session_number,model_code) values(pid,1,'A') returning id into sid;
 insert into public.training_exercises(session_id,position,name) values(sid,0,'Nuevo ejercicio') returning id into eid;
 if exists(select 1 from public.exercise_catalog where name='Nuevo ejercicio') then raise exception 'Se registró el nombre provisional'; end if;
 select revision into rev from public.training_sessions where id=sid;
 perform public.save_training_exercise(sid,rev,jsonb_build_object('id',eid,'name','Remo libre','notes','Espalda neutra','material','Banda','adaptation','Sentado','sets','[]'::jsonb));
 select catalog_exercise_id into cid from public.training_exercises where id=eid;
 if cid is null or not exists(select 1 from public.exercise_catalog where id=cid and name='Remo libre' and description='Espalda neutra') then raise exception 'El ejercicio libre de sesión no llegó a la biblioteca'; end if;
 update public.training_exercises set notes='Cambio individual' where id=eid;
 if (select description from public.exercise_catalog where id=cid) <> 'Espalda neutra' then raise exception 'La personalización cambió la biblioteca'; end if;
 update public.exercise_catalog set archived=true where id=cid;
 insert into public.training_exercises(session_id,position,name) values(sid,1,'Remo libre');
 if (select count(*) from public.exercise_catalog where lower(name)='remo libre') <> 1 or not (select archived from public.exercise_catalog where id=cid) then raise exception 'Se duplicó o reactivó una ficha archivada'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', true);
do $$ begin
 begin
   insert into public.monthly_training_models(period_month,model_code,draft) values('2027-01-01','A','[{"name":"Intruso","patterns":["core"]}]');
   raise exception 'RLS permite guardar sin permisos';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.exercise_catalog where name='Intruso') then raise exception 'RLS dejó ficha huérfana'; end if;
end $$;
rollback;
