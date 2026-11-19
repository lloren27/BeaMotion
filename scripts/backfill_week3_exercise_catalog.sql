-- Solo Supabase de entrenamientos. Reejecutable, sin cambiar modelos ni sesiones.
-- Recupera noviembre de 2026, semana 3 (09–15), incluso ejercicios que solo
-- permanecen en versiones publicadas. Prioridad: borrador, versión más reciente.
begin;
lock table public.exercise_catalog in share row exclusive mode;
with sources as (
 select m.model_code, 0 as priority, 0 as version_number, m.draft as exercises
 from public.monthly_training_models m where m.period_month='2026-11-01' and m.week_number=3
 union all
 select m.model_code, 1, v.version_number, v.snapshot
 from public.monthly_training_models m join public.monthly_model_versions v on v.model_id=m.id
 where m.period_month='2026-11-01' and m.week_number=3
), candidates as (
 select e.value as exercise, lower(trim(regexp_replace(e.value->>'name','\s+',' ','g'))) as name_key,
   s.priority, s.version_number, s.model_code, e.ordinality
 from sources s cross join lateral jsonb_array_elements(s.exercises) with ordinality e
), unique_exercises as (
 select distinct on (name_key) * from candidates
 where coalesce(name_key,'') not in ('','nuevo ejercicio')
 order by name_key,priority,version_number desc,model_code,ordinality
), inserted as (
 insert into public.exercise_catalog(name,description,patterns,notes)
 select trim(regexp_replace(exercise->>'name','\s+',' ','g')), coalesce(exercise->>'description',''),
   array(select jsonb_array_elements_text(exercise->'patterns')),
   concat_ws(E'\n',
     'Material: ' || nullif(exercise->>'material',''),
     'Progresión / regresión: ' || nullif(exercise->>'adaptation',''),
     'Carga: ' || nullif(exercise->>'load',''),
     'Series: ' || nullif(exercise->>'series',''),
     'Repeticiones: ' || nullif(exercise->>'repetitions',''),
     'Duración: ' || nullif(exercise->>'duration',''),
     'Descanso: ' || nullif(exercise->>'rest',''))
 from unique_exercises u where not exists (
   select 1 from public.exercise_catalog c where lower(trim(regexp_replace(c.name,'\s+',' ','g')))=u.name_key
 )
 returning id,name
)
select count(*) as ejercicios_incorporados, coalesce(jsonb_agg(name order by name),'[]'::jsonb) as nombres from inserted;
commit;
