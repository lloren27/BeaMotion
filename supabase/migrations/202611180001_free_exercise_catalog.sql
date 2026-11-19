-- Solo Supabase de entrenamientos, después de 202611110001.
begin;

-- La ficha es una copia inicial reutilizable. Las personalizaciones posteriores
-- no deben sobrescribir una ficha existente ni reactivar ejercicios archivados.
create function public.ensure_free_exercise_in_catalog(p_name text, p_description text, p_patterns text[], p_notes text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare exercise_id uuid; normalized_name text;
begin
 normalized_name := lower(trim(regexp_replace(coalesce(p_name,''), '\s+', ' ', 'g')));
 if normalized_name in ('', 'nuevo ejercicio') then return null; end if;
 -- Serializa altas concurrentes del mismo nombre sin imponer unicidad sobre
 -- las fichas históricas que el usuario ya haya creado manualmente.
 perform pg_advisory_xact_lock(hashtextextended('exercise-catalog:' || normalized_name, 0));
 select id into exercise_id from public.exercise_catalog
 where lower(trim(regexp_replace(name, '\s+', ' ', 'g')))=normalized_name
 order by archived, created_at, id limit 1;
 if exercise_id is null then
   insert into public.exercise_catalog(name,description,patterns,notes)
   values(trim(regexp_replace(p_name, '\s+', ' ', 'g')),coalesce(p_description,''),coalesce(p_patterns,'{}'),coalesce(p_notes,''))
   returning id into exercise_id;
 end if;
 return exercise_id;
end $$;

create function public.catalog_model_free_exercises() returns trigger
language plpgsql security invoker set search_path=public as $$
declare exercise jsonb;
begin
 for exercise in select value from jsonb_array_elements(new.draft) order by lower(trim(regexp_replace(value->>'name', '\s+', ' ', 'g'))) loop
   perform public.ensure_free_exercise_in_catalog(exercise->>'name',exercise->>'description',
     array(select jsonb_array_elements_text(exercise->'patterns')),
     concat_ws(E'\n',
       'Material: ' || nullif(exercise->>'material',''),
       'Progresión / regresión: ' || nullif(exercise->>'adaptation',''),
       'Carga: ' || nullif(exercise->>'load',''),
       'Series: ' || nullif(exercise->>'series',''),
       'Repeticiones: ' || nullif(exercise->>'repetitions',''),
       'Duración: ' || nullif(exercise->>'duration',''),
       'Descanso: ' || nullif(exercise->>'rest','')));
 end loop;
 return new;
end $$;
-- AFTER: primero se validan el modelo, sus patrones y los permisos RLS.
create trigger catalog_model_free_exercises after insert or update of draft on public.monthly_training_models
 for each row execute function public.catalog_model_free_exercises();

create function public.catalog_session_free_exercise() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.catalog_exercise_id is null then
   new.catalog_exercise_id := public.ensure_free_exercise_in_catalog(new.name,new.notes,new.patterns,
     concat_ws(E'\n','Material: ' || nullif(new.material,''),'Progresión / regresión: ' || nullif(new.adaptation,'')));
   select to_jsonb(c) - 'id' - 'name' - 'archived' - 'created_at' into new.catalog_snapshot
   from public.exercise_catalog c where c.id=new.catalog_exercise_id;
 end if;
 return new;
end $$;
create trigger catalog_session_free_exercise before insert or update of name,notes,patterns,material,adaptation on public.training_exercises
 for each row execute function public.catalog_session_free_exercise();

revoke all on function public.ensure_free_exercise_in_catalog(text,text,text[],text), public.catalog_model_free_exercises(), public.catalog_session_free_exercise() from public,anon;
grant execute on function public.ensure_free_exercise_in_catalog(text,text,text[],text) to authenticated;
commit;
