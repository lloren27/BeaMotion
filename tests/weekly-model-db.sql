\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000021'), ('00000000-0000-0000-0000-000000000022');
insert into public.training_admins(user_id) values ('00000000-0000-0000-0000-000000000021');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);
select public.create_monthly_models('2026-11-01', false);
do $$
declare base_id uuid; second_id uuid; third_id uuid; revision integer; second_revision integer;
 a jsonb := '[{"name":"Base","patterns":["core","empuje superior","tracción inferior"]}]';
 b jsonb := '[{"name":"Personalizado","patterns":["core","empuje superior","tracción inferior"]}]';
 c jsonb := '[{"name":"Nueva base","patterns":["core","empuje superior","tracción inferior"]}]';
begin
 if (select count(*) from public.monthly_training_models where period_month='2026-11-01') <> 18 then raise exception 'Se esperan seis semanas con tres modelos'; end if;
 select id into base_id from public.monthly_training_models where period_month='2026-11-01' and model_code='A' and week_number=1;
 select id into second_id from public.monthly_training_models where period_month='2026-11-01' and model_code='A' and week_number=2;
 select id into third_id from public.monthly_training_models where period_month='2026-11-01' and model_code='A' and week_number=3;
 revision := public.save_monthly_model_draft(base_id,0,a);
 if (select draft from public.monthly_training_models where id=second_id) <> a then raise exception 'No hereda la base'; end if;
 select m.revision into second_revision from public.monthly_training_models m where id=second_id;
 if public.save_monthly_model_draft(second_id,second_revision,a) <> second_revision then raise exception 'Guardar sin cambios no debe personalizar'; end if;
 second_revision := public.save_monthly_model_draft(second_id,second_revision,b);
 perform public.publish_monthly_model(second_id,second_revision);
 revision := public.save_monthly_model_draft(base_id,revision,c);
 if (select draft from public.monthly_training_models where id=second_id) <> b then raise exception 'Se sobrescribió la semana personalizada'; end if;
 if (select draft from public.monthly_training_models where id=third_id) <> c then raise exception 'No se actualizó semana heredada'; end if;
 perform public.restore_week_from_base(second_id,second_revision);
 if not (select inherits_base from public.monthly_training_models where id=second_id) or (select draft from public.monthly_training_models where id=second_id) <> c then raise exception 'No se restauró la herencia'; end if;
 if (select snapshot from public.monthly_model_versions where model_id=second_id and version_number=1) <> b then raise exception 'Cambió una versión publicada'; end if;
 begin perform public.save_monthly_model_draft(third_id,0,a); raise exception 'Se aceptó revisión obsoleta'; exception when serialization_failure then null; end;
 perform public.create_monthly_models('2026-12-01',true);
 if (select count(*) from public.monthly_training_models where period_month='2026-12-01') <> 15 then raise exception 'Diciembre debe tener cinco semanas'; end if;
 if (select draft from public.monthly_training_models where period_month='2026-12-01' and model_code='A' and week_number=5) <> c then raise exception 'No copió la base del mes anterior'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);
do $$ begin
 if (select count(*) from public.monthly_training_models) <> 0 then raise exception 'Acceso de lectura indebido'; end if;
 begin perform public.create_monthly_models('2027-01-01',false); raise exception 'Acceso de escritura indebido'; exception when insufficient_privilege then null; end;
end $$;
rollback;
