-- Esquema de entrenamientos para el proyecto Supabase propio de BeaMotion.
-- Aplicar solo en el proyecto nuevo; no ejecutar en Lovable Cloud.

begin;

create table if not exists public.training_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  session_count smallint not null check (session_count in (4, 8, 12)),
  created_at timestamptz not null default now(),
  unique (client_id, period_month)
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_monthly_plans(id) on delete cascade,
  session_number smallint not null,
  model_code text not null check (model_code in ('A', 'B', 'C')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'not_completed')),
  not_completed_reason text check (not_completed_reason in ('cancelled', 'changed')),
  session_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, session_number),
  check ((status = 'not_completed' and not_completed_reason is not null) or
         (status <> 'not_completed' and not_completed_reason is null)),
  check ((status = 'completed' and completed_at is not null) or
         (status <> 'completed' and completed_at is null))
);

create table if not exists public.training_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  position smallint not null,
  name text not null check (length(trim(name)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (session_id, position)
);

create table if not exists public.training_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.training_exercises(id) on delete cascade,
  position smallint not null,
  series_count smallint check (series_count is null or series_count > 0),
  repetitions text,
  rest text,
  load text,
  actual_series_count text,
  actual_repetitions text,
  actual_rest text,
  actual_load text,
  actual_notes text,
  created_at timestamptz not null default now(),
  unique (exercise_id, position)
);

create table if not exists public.training_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists training_sessions_plan_number_idx
  on public.training_sessions (plan_id, session_number);
create index if not exists training_exercises_session_position_idx
  on public.training_exercises (session_id, position);
create index if not exists training_sets_exercise_position_idx
  on public.training_sets (exercise_id, position);

alter table public.training_monthly_plans enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_exercises enable row level security;
alter table public.training_sets enable row level security;
alter table public.training_admins enable row level security;

create or replace function public.is_training_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.training_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_training_admin() from public;
grant execute on function public.is_training_admin() to authenticated;

create policy training_admin_all on public.training_monthly_plans
  for all to authenticated using (public.is_training_admin()) with check (public.is_training_admin());
create policy training_admin_all on public.training_sessions
  for all to authenticated using (public.is_training_admin()) with check (public.is_training_admin());
create policy training_admin_all on public.training_exercises
  for all to authenticated using (public.is_training_admin()) with check (public.is_training_admin());
create policy training_admin_all on public.training_sets
  for all to authenticated using (public.is_training_admin()) with check (public.is_training_admin());

grant select, insert, update, delete on public.training_monthly_plans,
  public.training_sessions, public.training_exercises, public.training_sets to authenticated;

create or replace function public.create_training_monthly_plan(
  p_client_id uuid,
  p_period_month date,
  p_session_count smallint
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_existing_count smallint;
  v_sequence text[];
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_session_count not in (4, 8, 12) or extract(day from p_period_month) <> 1 then
    raise exception 'invalid monthly plan' using errcode = '22023';
  end if;

  v_sequence := case p_session_count
    when 4 then array['C']
    when 8 then array['A', 'B']
    else array['A', 'B', 'C']
  end;

  insert into public.training_monthly_plans (client_id, period_month, session_count)
  values (p_client_id, p_period_month, p_session_count)
  on conflict (client_id, period_month) do nothing
  returning id into v_plan_id;

  if v_plan_id is null then
    select id, session_count into v_plan_id, v_existing_count
    from public.training_monthly_plans
    where client_id = p_client_id and period_month = p_period_month;
    if v_existing_count <> p_session_count then
      raise exception 'A plan already exists with a different session count' using errcode = '23505';
    end if;
    return v_plan_id;
  end if;

  for v_index in 1..p_session_count loop
    insert into public.training_sessions (plan_id, session_number, model_code)
    values (v_plan_id, v_index, v_sequence[((v_index - 1) % cardinality(v_sequence)) + 1]);
  end loop;
  return v_plan_id;
end;
$$;

revoke all on function public.create_training_monthly_plan(uuid, date, smallint) from public, anon;
grant execute on function public.create_training_monthly_plan(uuid, date, smallint) to authenticated;

commit;
