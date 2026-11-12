\set ON_ERROR_STOP on
begin;
do $$ begin
 if not (select personalized from training_sessions where id='00000000-0000-0000-0000-000000000083') then raise exception 'No protegió contenido anterior'; end if;
 if (select actual_repetitions from training_sets where exercise_id='00000000-0000-0000-0000-000000000084')<>'7' then raise exception 'Alteró resultados anteriores'; end if;
 if (select draft->0->>'name' from monthly_training_models where period_month='2098-01-01' and model_code='A')<>'Movilidad anterior' then raise exception 'Alteró borrador anterior'; end if;
end $$;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000031'), ('00000000-0000-0000-0000-000000000032');
insert into public.training_admins values ('00000000-0000-0000-0000-000000000031',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000031',true);
select public.create_monthly_models('2099-06-01',false);
do $$
declare m uuid; r integer; result jsonb; sid uuid; eid uuid;
 clients jsonb := '[{"client_id":"00000000-0000-0000-0000-000000000041","bono_id":"00000000-0000-0000-0000-000000000051","session_count":8,"bookings":[{"id":"00000000-0000-0000-0000-000000000061","date":"2099-06-01","active":true,"attended":false}]}]';
begin
 select id into m from monthly_training_models where period_month='2099-06-01' and week_number=1 and model_code='A';
 begin
  perform save_monthly_model_draft(m,0,'[{"name":"Incompatible","patterns":["empuje inferior"]}]');
  raise exception 'Aceptó ejercicio incompatible' using errcode='XX000';
 exception when check_violation then null; end;
 r := save_monthly_model_draft(m,0,'[{"name":"Press","patterns":["core","empuje superior","tracción inferior"],"series":"3","duration":"30 s","material":"Banda","adaptation":"Menos tensión","load":"8 kg"}]');
 result := publish_model_with_bookings(m,r,clients,clock_timestamp());
 if (result->>'distributed')::int <> 1 then raise exception 'No distribuyó: %',result; end if;
 select s.id into sid from training_sessions s join training_monthly_plans p on p.id=s.plan_id where p.client_id='00000000-0000-0000-0000-000000000041' and s.session_number=1;
 select id into eid from training_exercises where session_id=sid;
 if (select material from training_exercises where id=eid) <> 'Banda' then raise exception 'No copió material'; end if;
 if (select duration from training_sets where exercise_id=eid) <> '30 s' then raise exception 'No copió duración'; end if;
 if exists(select 1 from training_sets where exercise_id=eid and actual_load is not null) then raise exception 'Rellenó resultados'; end if;
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if (select count(*) from training_exercises where session_id=sid) <> 1 then raise exception 'Duplicó ejercicios'; end if;
 update training_exercises set name='Mi adaptación' where id=eid;
 r := save_monthly_model_draft(m,r,'[{"name":"Nuevo press","patterns":["core","empuje superior","tracción inferior"]}]');
 perform publish_model_with_bookings(m,r,clients,clock_timestamp());
 if (select name from training_exercises where id=eid) <> 'Mi adaptación' then raise exception 'Sobrescribió personalización'; end if;
 update training_sessions set status='completed',completed_at=now() where id=sid;
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if (select attendance_confirmed from training_sessions where id=sid) then raise exception 'Confundió realización manual con asistencia'; end if;
end $$;

do $$
declare m uuid; mb uuid; rev integer; v jsonb; sid uuid; eid uuid; sr integer; before_versions integer;
 clients jsonb := '[{"client_id":"00000000-0000-0000-0000-000000000042","bono_id":"00000000-0000-0000-0000-000000000052","session_count":8,"bookings":[{"id":"00000000-0000-0000-0000-000000000062","date":"2099-06-01","active":true,"attended":false},{"id":"00000000-0000-0000-0000-000000000063","date":"2099-06-08","active":true,"attended":false}]}]';
 draft jsonb := '[{"name":"Inicial","patterns":["core","empuje superior","tracción inferior"],"series":"3-4","repetitions":"8","rest":"60 s"}]';
begin
 select id,revision into m,rev from monthly_training_models where period_month='2099-06-01' and model_code='A' and week_number=1;
 rev:=save_monthly_model_draft(m,rev,draft);
 v:=publish_model_with_bookings(m,rev,clients,clock_timestamp());
 select s.id,s.revision into sid,sr from training_sessions s join training_monthly_plans p on p.id=s.plan_id where p.client_id='00000000-0000-0000-0000-000000000042' and s.session_number=1;
 select id into eid from training_exercises where session_id=sid;
 if (select planned_series from training_sets where exercise_id=eid)<>'3-4' then raise exception 'Perdió series en texto'; end if;
 if (select string_agg(model_code,'' order by session_number) from training_sessions where plan_id=(select plan_id from training_sessions where id=sid))<>'ABABABAB' then raise exception 'Secuencia 8 incorrecta'; end if;
 if exists(select 1 from training_exercises e join training_sessions s on s.id=e.session_id where s.booking_id='00000000-0000-0000-0000-000000000063') then raise exception 'Asignó letra o semana incorrecta'; end if;
 rev:=save_monthly_model_draft(m,rev,jsonb_set(draft,'{0,name}','"Actualizado"'));
 perform publish_model_with_bookings(m,rev,clients,clock_timestamp());
 if (select name from training_exercises where session_id=sid)<>'Actualizado' then raise exception 'No actualizó copia intacta'; end if;
 begin perform save_training_exercise(sid,sr,jsonb_build_object('id',eid,'name','Pantalla antigua','sets','[]'::jsonb)); raise exception 'Aceptó guardado obsoleto' using errcode='XX000'; exception when serialization_failure then null; end;
 -- Asistencia observada antes de publicar protege contenido previo.
 clients:=jsonb_set(clients,'{0,bookings,0,attended}','true');
 rev:=save_monthly_model_draft(m,rev,jsonb_set(draft,'{0,name}','"No debe sustituir"'));
 perform publish_model_with_bookings(m,rev,clients,clock_timestamp());
 if (select status from training_sessions where id=sid)<>'completed' or (select name from training_exercises where session_id=sid)<>'Actualizado' then raise exception 'No protegió asistencia'; end if;
 before_versions:=(select count(*) from monthly_model_versions);
 begin perform publish_model_with_bookings(m,rev,clients,clock_timestamp()-interval '10 minutes'); raise exception 'Aceptó snapshot caducado' using errcode='XX000'; exception when serialization_failure then null; end;
 if (select count(*) from monthly_model_versions)<>before_versions then raise exception 'Publicación parcial'; end if;
 -- Reprogramación de copia intacta a semana sin publicar elimina copia obsoleta.
 clients:='[{"client_id":"00000000-0000-0000-0000-000000000043","bono_id":"00000000-0000-0000-0000-000000000053","session_count":4,"bookings":[{"id":"00000000-0000-0000-0000-000000000064","date":"2099-06-01","active":true,"attended":false}]}]';
 select id,revision into mb,rev from monthly_training_models where period_month='2099-06-01' and model_code='C' and week_number=1;
 rev:=save_monthly_model_draft(mb,rev,'[{"name":"Completo","patterns":["core","empuje superior","tracción superior","empuje inferior","tracción inferior"]}]');
 perform publish_model_with_bookings(mb,rev,clients,clock_timestamp());
 select id into sid from training_sessions where booking_id='00000000-0000-0000-0000-000000000064';
 if (select string_agg(model_code,'' order by session_number) from training_sessions where plan_id=(select plan_id from training_sessions where id=sid))<>'CCCC' then raise exception 'Secuencia 4 incorrecta'; end if;
 clients:=jsonb_set(clients,'{0,bookings,0,date}','"2099-06-08"');
 perform publish_model_with_bookings(mb,rev,clients,clock_timestamp());
 if exists(select 1 from training_exercises where session_id=sid) then raise exception 'Conservó ejercicios de otra semana'; end if;
 clients:=jsonb_set(clients,'{0,bookings,0,date}','"2099-06-01"');
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if (select count(*) from training_exercises where session_id=sid)<>1 then raise exception 'No completó reserva posterior'; end if;
 clients:=jsonb_set(clients,'{0,bookings,0,active}','false');
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if exists(select 1 from training_exercises where session_id=sid) or (select booking_id from training_sessions where id=sid) is not null then raise exception 'No liberó cancelada intacta'; end if;
 -- Resultados individuales protegen incluso una sesión todavía pendiente.
 clients:=jsonb_set(clients,'{0,bookings,0,active}','true');
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 select id into eid from training_exercises where session_id=sid;
 update training_sets set actual_repetitions='7' where exercise_id=eid;
 perform publish_model_with_bookings(mb,rev,clients,clock_timestamp());
 if (select actual_repetitions from training_sets where exercise_id=eid)<>'7' then raise exception 'Perdió resultados'; end if;
 clients:=jsonb_set(clients,'{0,bookings,0,date}','"2099-06-08"');
 v:=sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if jsonb_array_length(v->'excluded')<>1 or (select scheduled_date from training_sessions where id=sid)<>'2099-06-01' then raise exception 'No detectó conflicto de reprogramación'; end if;

 -- Insertar una reserva anterior no puede cambiar silenciosamente la secuencia.
 clients:='[{"client_id":"00000000-0000-0000-0000-000000000045","bono_id":"00000000-0000-0000-0000-000000000055","session_count":8,"bookings":[{"id":"00000000-0000-0000-0000-000000000065","date":"2099-06-20","active":true,"attended":false}]}]';
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 clients:=jsonb_set(clients,'{0,bookings}',(clients->0->'bookings')||'[{"id":"00000000-0000-0000-0000-000000000066","date":"2099-06-18","active":true,"attended":false}]');
 v:=sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if jsonb_array_length(v->'excluded')<>1 or exists(select 1 from training_sessions where booking_id='00000000-0000-0000-0000-000000000066') then raise exception 'Desordenó la secuencia cronológica'; end if;
 -- 12 sesiones, perfil nunca abierto, bono incompatible excluido.
 clients:='[{"client_id":"00000000-0000-0000-0000-000000000044","bono_id":"00000000-0000-0000-0000-000000000054","session_count":12,"bookings":[]}]';
 perform sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if (select string_agg(s.model_code,'' order by s.session_number) from training_sessions s join training_monthly_plans p on p.id=s.plan_id where p.client_id='00000000-0000-0000-0000-000000000044')<>'ABCABCABCABC' then raise exception 'Secuencia 12 incorrecta'; end if;
 clients:=jsonb_set(clients,'{0,session_count}','8');
 v:=sync_training_bookings('2099-06-01',clients,clock_timestamp());
 if jsonb_array_length(v->'excluded')<>1 then raise exception 'Cambió bono existente'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000032',true);
do $$ begin
 begin perform sync_training_bookings('2099-06-01','[]',clock_timestamp()); raise exception 'Acceso indebido' using errcode='XX000'; exception when insufficient_privilege then null; end;
end $$;
rollback;
