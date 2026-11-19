\set ON_ERROR_STOP on
-- Fixtures históricas: no disparar el alta automática que se está probando aparte.
alter table public.monthly_training_models disable trigger catalog_model_free_exercises;
insert into public.monthly_training_models(id,period_month,model_code,week_number,draft) values
 ('80000000-0000-0000-0000-000000000001','2026-11-01','A',3,'[{"name":"Recuperado","description":"Actual","patterns":["core"],"load":"Barra 15 + 15","material":"Barra","adaptation":"Menos peso","series":"4","repetitions":"6"},{"name":"Existente","patterns":["core"]}]'),
 ('80000000-0000-0000-0000-000000000002','2026-11-01','B',3,'[{"name":"RECUPERADO","description":"Duplicado","patterns":["core"]}]'),
 ('80000000-0000-0000-0000-000000000003','2026-11-01','A',2,'[{"name":"Otra semana","patterns":["core"]}]'),
 ('80000000-0000-0000-0000-000000000004','2026-12-01','A',3,'[{"name":"Otro mes","patterns":["core"]}]');
alter table public.monthly_training_models enable trigger catalog_model_free_exercises;
insert into public.monthly_model_versions(model_id,version_number,snapshot) values
 ('80000000-0000-0000-0000-000000000001',1,'[{"name":"Recuperado","description":"Antigua","patterns":["core"]},{"name":"Solo publicado","patterns":["core"]}]');
insert into public.exercise_catalog(name,description) values('Existente','Conservar');
create temp table original_models as select id,draft,revision from public.monthly_training_models;
create temp table original_versions as select id,snapshot from public.monthly_model_versions;
\ir ../scripts/backfill_week3_exercise_catalog.sql
\ir ../scripts/backfill_week3_exercise_catalog.sql
do $$ begin
 if (select count(*) from public.exercise_catalog where lower(name)='recuperado') <> 1 then raise exception 'Recuperación no idempotente'; end if;
 if not exists(select 1 from public.exercise_catalog where name='Recuperado' and description='Actual' and notes like '%Carga: Barra 15 + 15%' and notes like '%Series: 4%') then raise exception 'Se perdieron datos o no se priorizó el borrador'; end if;
 if not exists(select 1 from public.exercise_catalog where name='Solo publicado') then raise exception 'No se recuperaron versiones publicadas'; end if;
 if not exists(select 1 from public.exercise_catalog where name='Existente' and description='Conservar') then raise exception 'Se sobrescribió la biblioteca'; end if;
 if exists(select 1 from public.exercise_catalog where name in ('Otra semana','Otro mes')) then raise exception 'La recuperación excede la semana solicitada'; end if;
 if exists(select id,draft,revision from public.monthly_training_models except select * from original_models)
 or exists(select id,snapshot from public.monthly_model_versions except select * from original_versions) then raise exception 'Se alteraron modelos o versiones'; end if;
end $$;
