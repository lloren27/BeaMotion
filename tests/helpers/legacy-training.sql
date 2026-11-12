-- Datos anteriores al sprint 3: deben sobrevivir a la migración.
insert into public.training_monthly_plans(id,client_id,period_month,session_count)
values('00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','2098-01-01',4);
insert into public.training_sessions(id,plan_id,session_number,model_code)
values('00000000-0000-0000-0000-000000000083','00000000-0000-0000-0000-000000000081',1,'C');
insert into public.training_exercises(id,session_id,position,name)
values('00000000-0000-0000-0000-000000000084','00000000-0000-0000-0000-000000000083',0,'Ejercicio anterior');
insert into public.training_sets(exercise_id,position,series_count,actual_repetitions)
values('00000000-0000-0000-0000-000000000084',0,3,'7');
insert into public.monthly_training_models(period_month,model_code,draft)
values('2098-01-01','A','[{"name":"Movilidad anterior","patterns":["movilidad"]}]');
