-- Ejecutar únicamente en el proyecto de entrenamientos de BeaMotion.
begin;
create table public.monthly_training_models (
  id uuid primary key default gen_random_uuid(),
  period_month date not null check (extract(day from period_month) = 1),
  model_code text not null check (model_code in ('A', 'B', 'C')),
  draft jsonb not null default '[]'::jsonb check (jsonb_typeof(draft) = 'array'),
  revision integer not null default 0,
  unique (period_month, model_code)
);
create table public.monthly_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.monthly_training_models(id),
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'array'),
  published_at timestamptz not null default now(),
  unique (model_id, version_number)
);
alter table public.monthly_training_models enable row level security;
alter table public.monthly_model_versions enable row level security;
create policy monthly_model_admin on public.monthly_training_models for all to authenticated
 using (public.is_training_admin()) with check (public.is_training_admin());
create policy monthly_version_read on public.monthly_model_versions for select to authenticated
 using (public.is_training_admin());
grant select, insert, update on public.monthly_training_models to authenticated;
grant select on public.monthly_model_versions to authenticated;

create function public.create_monthly_models(p_month date, p_copy_previous boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare previous_month date := (p_month - interval '1 month')::date;
begin
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'Mes no válido'; end if;
  if exists (select 1 from public.monthly_training_models where period_month = p_month) then raise exception 'El mes ya existe'; end if;
  if p_copy_previous and (select count(*) from public.monthly_training_models where period_month = previous_month) <> 3 then
    raise exception 'El mes anterior no tiene los tres modelos';
  end if;
  insert into public.monthly_training_models(period_month, model_code, draft)
  select p_month, codes.code, case when p_copy_previous then old.draft else '[]'::jsonb end
  from (values ('A'), ('B'), ('C')) as codes(code)
  left join public.monthly_training_models old on old.period_month = previous_month and old.model_code = codes.code;
end $$;

create function public.save_monthly_model_draft(p_id uuid, p_revision integer, p_draft jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare next_revision integer;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'array' then raise exception 'Borrador no válido'; end if;
  update public.monthly_training_models set draft = p_draft, revision = revision + 1
  where id = p_id and revision = p_revision returning revision into next_revision;
  if next_revision is null then raise exception 'El modelo cambió o no está disponible. Recarga antes de guardar.' using errcode = '40001'; end if;
  return next_revision;
end $$;

create function public.publish_monthly_model(p_id uuid, p_revision integer)
returns integer language plpgsql security definer set search_path = public as $$
declare model public.monthly_training_models%rowtype; required text[]; pattern text; version integer;
begin
  if not public.is_training_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into model from public.monthly_training_models where id = p_id for update;
  if not found or model.revision <> p_revision then raise exception 'El modelo cambió. Recarga antes de publicar.' using errcode = '40001'; end if;
  if exists (select 1 from jsonb_array_elements(model.draft) e where length(trim(coalesce(e->>'name', ''))) = 0 or jsonb_typeof(e->'patterns') is distinct from 'array') then
    raise exception 'Cada ejercicio debe tener un nombre y sus patrones';
  end if;
  required := case model.model_code when 'A' then array['core','empuje superior','tracción inferior']
    when 'B' then array['core','tracción superior','tracción inferior']
    else array['core','empuje superior','empuje inferior','tracción superior','tracción inferior'] end;
  foreach pattern in array required loop
    if not exists (select 1 from jsonb_array_elements(model.draft) e where (e->'patterns') ? pattern) then
      raise exception 'Falta el patrón requerido: %', pattern;
    end if;
  end loop;
  select coalesce(max(version_number),0)+1 into version from public.monthly_model_versions where model_id = p_id;
  insert into public.monthly_model_versions(model_id,version_number,snapshot) values (p_id,version,model.draft);
  return version;
end $$;
revoke all on function public.create_monthly_models(date, boolean), public.save_monthly_model_draft(uuid, integer, jsonb), public.publish_monthly_model(uuid, integer) from public, anon;
grant execute on function public.create_monthly_models(date, boolean), public.save_monthly_model_draft(uuid, integer, jsonb), public.publish_monthly_model(uuid, integer) to authenticated;
commit;
