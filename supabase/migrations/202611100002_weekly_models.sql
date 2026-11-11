-- Aplicar después de 202611100001, únicamente en el Supabase de entrenamientos.
begin;
alter table public.monthly_training_models
  add column week_number smallint not null default 1 check (week_number between 1 and 6),
  add column inherits_base boolean not null default false;
alter table public.monthly_training_models drop constraint monthly_training_models_period_month_model_code_key;
alter table public.monthly_training_models add constraint monthly_model_week_unique unique (period_month, model_code, week_number);
create function public.month_week_count(p_month date) returns integer language sql immutable strict as $$
  select ((extract(isodow from p_month)::integer - 1 + extract(day from (p_month + interval '1 month - 1 day'))::integer - 1) / 7) + 1;
$$;
-- Preservar modelos y versiones existentes como primera semana.
insert into public.monthly_training_models(period_month, model_code, week_number, inherits_base, draft)
select m.period_month, m.model_code, week.n, true, m.draft
from public.monthly_training_models m
cross join lateral generate_series(2, public.month_week_count(m.period_month)) as week(n)
where m.week_number = 1
on conflict (period_month, model_code, week_number) do nothing;

create or replace function public.create_monthly_models(p_month date, p_copy_previous boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare previous_month date := (p_month - interval '1 month')::date;
begin
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'Mes no válido'; end if;
  if exists (select 1 from public.monthly_training_models where period_month = p_month) then raise exception 'El mes ya existe'; end if;
  if p_copy_previous and (select count(*) from public.monthly_training_models where period_month = previous_month and week_number = 1) <> 3 then
    raise exception 'El mes anterior no tiene los tres modelos';
  end if;
  insert into public.monthly_training_models(period_month, model_code, week_number, inherits_base, draft)
  select p_month, codes.code, week.n, week.n > 1, case when p_copy_previous then old.draft else '[]'::jsonb end
  from (values ('A'), ('B'), ('C')) as codes(code)
  cross join generate_series(1, public.month_week_count(p_month)) as week(n)
  left join public.monthly_training_models old on old.period_month = previous_month and old.model_code = codes.code and old.week_number = 1;
end $$;

create or replace function public.save_monthly_model_draft(p_id uuid, p_revision integer, p_draft jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare model public.monthly_training_models%rowtype; next_revision integer;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'array' then raise exception 'Borrador no válido'; end if;
  select * into model from public.monthly_training_models where id = p_id for update;
  if not found or model.revision <> p_revision then raise exception 'El modelo cambió o no está disponible. Recarga antes de guardar.' using errcode = '40001'; end if;
  if model.draft = p_draft then return model.revision; end if;
  update public.monthly_training_models set draft = p_draft, revision = revision + 1,
    inherits_base = case when week_number > 1 then false else inherits_base end
    where id = p_id returning revision into next_revision;
  if model.week_number = 1 then
    update public.monthly_training_models set draft = p_draft, revision = revision + 1
    where period_month = model.period_month and model_code = model.model_code and week_number > 1 and inherits_base and draft is distinct from p_draft;
  end if;
  return next_revision;
end $$;

create function public.restore_week_from_base(p_id uuid, p_revision integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare model public.monthly_training_models%rowtype; base_draft jsonb; next_revision integer;
begin
  select * into model from public.monthly_training_models where id = p_id;
  if not found or model.week_number = 1 then raise exception 'Semana no válida'; end if;
  select draft into base_draft from public.monthly_training_models where period_month = model.period_month and model_code = model.model_code and week_number = 1 for update;
  if not found then raise exception 'No existe el modelo base'; end if;
  update public.monthly_training_models set draft = base_draft, inherits_base = true, revision = revision + 1
  where id = p_id and revision = p_revision returning revision into next_revision;
  if next_revision is null then raise exception 'El modelo cambió. Recarga antes de actualizar.' using errcode = '40001'; end if;
  return next_revision;
end $$;
revoke all on function public.restore_week_from_base(uuid, integer) from public, anon;
grant execute on function public.restore_week_from_base(uuid, integer) to authenticated;
commit;
