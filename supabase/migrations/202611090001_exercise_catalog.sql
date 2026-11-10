-- Ejecutar en el proyecto de entrenamientos de BeaMotion, después de 202611040001.
begin;
create table public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  patterns text[] not null default '{}',
  laterality text[] not null default '{}',
  positions text[] not null default '{}',
  actions text[] not null default '{}',
  band_color text not null default '',
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  action_time text not null default '',
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.exercise_catalog enable row level security;
create policy exercise_catalog_admin on public.exercise_catalog for all to authenticated
  using (public.is_training_admin()) with check (public.is_training_admin());
grant select, insert, update on public.exercise_catalog to authenticated;

alter table public.training_exercises
  add column catalog_exercise_id uuid references public.exercise_catalog(id) on delete set null,
  add column catalog_snapshot jsonb;

-- La lectura y la copia ocurren en una operación; la sesión no depende de futuras ediciones.
create function public.add_catalog_exercise_to_session(p_session_id uuid, p_position smallint, p_catalog_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.training_exercises (session_id, position, name, notes, catalog_exercise_id, catalog_snapshot)
  select p_session_id, p_position, c.name, nullif(concat_ws(E'\n', nullif(c.description, ''), nullif(c.notes, '')), ''), c.id,
    jsonb_build_object('description', c.description, 'patterns', c.patterns, 'laterality', c.laterality,
      'positions', c.positions, 'actions', c.actions, 'band_color', c.band_color,
      'weight_kg', c.weight_kg, 'action_time', c.action_time, 'notes', c.notes)
  from public.exercise_catalog c where c.id = p_catalog_id and not c.archived
  returning id into v_id;
  if v_id is null then raise exception 'exercise unavailable' using errcode = 'P0002'; end if;
  insert into public.training_sets (exercise_id, position, load)
  select v_id, 0, concat_ws(' · ', case when c.weight_kg is not null then c.weight_kg::text || ' kg' end,
    case when c.band_color <> '' then 'Goma ' || c.band_color end)
  from public.exercise_catalog c where c.id = p_catalog_id and (c.weight_kg is not null or c.band_color <> '');
  return v_id;
end;
$$;
revoke all on function public.add_catalog_exercise_to_session(uuid, smallint, uuid) from public, anon;
grant execute on function public.add_catalog_exercise_to_session(uuid, smallint, uuid) to authenticated;
commit;
