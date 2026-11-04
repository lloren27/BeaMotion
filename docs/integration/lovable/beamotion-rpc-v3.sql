-- BeaMotion · funciones RPC (v3)
--
-- SECURITY INVOKER: se ejecutan con los permisos de quien llama, así que RLS sigue
-- aplicando. Además comprueban explícitamente el rol admin (falla cerrado).
-- Requisito: las políticas RLS deben permitir a un admin leer estas tablas
-- (el panel web ya lo hace con su sesión). Si falta alguna, las pruebas del final lo muestran.
--
-- Todo va en una transacción para que nunca exista una función con permisos por defecto.

begin;

-- Limpieza de la v1 por si se llegó a aplicar (en una base limpia no hace nada)
drop function if exists public.is_admin_caller();
drop function if exists public.form_text(jsonb, text);
drop function if exists public.list_clients();
drop function if exists public.client_overview(uuid);
drop function if exists public.client_overview(uuid, int, int);   -- firma de la v2

-- ---------------------------------------------------------------------------
-- list_clients: clientes (incluye inactivos, excluye admins), paginado por offset
-- ---------------------------------------------------------------------------
create or replace function public.list_clients(
  p_limit  int default 200,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_rows   jsonb;
  v_more   boolean;
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role::text = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Se pide una fila de más para saber si hay página siguiente.
  select coalesce(jsonb_agg(to_jsonb(c) order by c.nombre, c.id), '[]'::jsonb)
    into v_rows
    from (
      select p.id, p.nombre, p.active, p.updated_at
        from public.profiles p
       where not exists (
         select 1 from public.user_roles r
          where r.user_id = p.id and r.role::text = 'admin'
       )
       order by p.nombre, p.id
       limit v_limit + 1 offset v_offset
    ) c;

  v_more := jsonb_array_length(v_rows) > v_limit;
  if v_more then
    v_rows := v_rows - v_limit;   -- quita la fila extra
  end if;

  return jsonb_build_object(
    'clients', v_rows,
    'next_offset', case when v_more then v_offset + v_limit end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- client_overview: ficha completa de un cliente (mismos datos que el endpoint)
-- ---------------------------------------------------------------------------
-- Historial, notas y diario se pagan por separado con limit + offset.
-- Primera carga: sin parámetros extra. "Cargar más": p_history_offset = 200, etc.
-- 'totals' indica cuántos hay en total para saber si quedan más.
create or replace function public.client_overview(
  p_client_id      uuid,
  p_history_limit  int default 200,
  p_history_offset int default 0,
  p_notes_limit    int default 100,
  p_notes_offset   int default 0,
  p_journal_limit  int default 100,
  p_journal_offset int default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_local         timestamp := now() at time zone 'Europe/Madrid';
  v_today         date      := v_local::date;
  v_monday        date      := date_trunc('week', v_local)::date;
  v_month         text      := to_char(v_local, 'YYYY-MM');
  v_hist_lim      int       := least(greatest(coalesce(p_history_limit, 200), 1), 1000);
  v_hist_off      int       := greatest(coalesce(p_history_offset, 0), 0);
  v_notes_lim     int       := least(greatest(coalesce(p_notes_limit, 100), 1), 500);
  v_notes_off     int       := greatest(coalesce(p_notes_offset, 0), 0);
  v_journal_lim   int       := least(greatest(coalesce(p_journal_limit, 100), 1), 500);
  v_journal_off   int       := greatest(coalesce(p_journal_offset, 0), 0);

  v_profile       record;
  v_unique        boolean   := false;
  v_has_form      boolean   := false;
  v_form_at       timestamptz;
  v_payload       jsonb;
  v_p             jsonb     := '{}'::jsonb;
  v_latest_form   jsonb     := null;

  v_bonos         jsonb;
  v_history       jsonb;
  v_week          jsonb;
  v_notes         jsonb;
  v_journal       jsonb;
  v_hist_total    int;
  v_notes_total   int;
  v_journal_total int;
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role::text = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.id, p.nombre, p.email, p.active, p.birth_date, p.updated_at
    into v_profile
    from public.profiles p
   where p.id = p_client_id;
  if not found then
    return null;
  end if;

  -- Un admin no se trata como cliente.
  if exists (
    select 1 from public.user_roles r
    where r.user_id = p_client_id and r.role::text = 'admin'
  ) then
    return null;
  end if;

  -- Bonos
  select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]'::jsonb)
    into v_bonos
    from (
      select cb.id, cb.status, cb.service_month, cb.sessions_total, cb.sessions_used,
             cb.payment_validated_at, cb.training_type, cb.covers, cb.price_cents,
             cb.updated_at
        from public.client_bonos cb
       where cb.user_id = p_client_id
    ) b;

  -- Historial: reservas + sesión + asistencia, más reciente primero, con límite
  select count(*) into v_hist_total
    from public.bookings b where b.user_id = p_client_id;

  select coalesce(jsonb_agg(h.entry order by h.starts_at desc nulls last, h.booking_id), '[]'::jsonb)
    into v_history
    from (
      select s.starts_at,
             b.id as booking_id,
             jsonb_build_object(
               'booking_id', b.id,
               'bono_id', b.bono_id,
               'booking_status', b.status,
               'booking_updated_at', b.updated_at,
               'session', case when s.id is null then null else jsonb_build_object(
                   'id', s.id,
                   'starts_at', s.starts_at,
                   'ends_at', s.ends_at,
                   'training_type', s.training_type,
                   'status', s.status) end,
               'attendance', case when a.booking_id is null then null else jsonb_build_object(
                   'booking_id', a.booking_id,
                   'status', a.status,
                   'recorded_at', a.recorded_at,
                   'note', a.note) end
             ) as entry
        from public.bookings b
        left join public.sessions s on s.id = b.session_id
        left join lateral (
          select at.booking_id, at.status, at.recorded_at, at.note
            from public.attendance at
           where at.booking_id = b.id
           order by at.recorded_at desc nulls last
           limit 1
        ) a on true
       where b.user_id = p_client_id
       order by s.starts_at desc nulls last, b.id
       limit v_hist_lim offset v_hist_off
    ) h;

  -- Sesiones reservadas esta semana (lunes a domingo, hora de Madrid)
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'booking_id', b.id,
             'starts_at', s.starts_at,
             'training_type', s.training_type
           ) order by s.starts_at), '[]'::jsonb)
    into v_week
    from public.bookings b
    join public.sessions s on s.id = b.session_id
   where b.user_id = p_client_id
     and b.status::text = 'booked'
     and (s.starts_at at time zone 'Europe/Madrid')::date >= v_monday
     and (s.starts_at at time zone 'Europe/Madrid')::date <  v_monday + 7;

  -- Formulario: se enlaza por email y solo si el email es único entre perfiles
  select count(*) = 1 into v_unique
    from public.profiles p
   where lower(p.email) = lower(v_profile.email);

  if v_unique then
    select fs.created_at, fs.payload::jsonb
      into v_form_at, v_payload
      from public.form_submissions fs
     where lower(fs.email) = lower(v_profile.email)
     order by fs.created_at desc
     limit 1;
    v_has_form := found;
  end if;

  if v_has_form then
    v_p := case when jsonb_typeof(v_payload) = 'object' then v_payload else '{}'::jsonb end;

    v_latest_form :=
      jsonb_build_object('created_at', v_form_at)
      -- campos de texto: solo si son string, si no null (igual que el endpoint)
      || (
        select jsonb_object_agg(
                 k,
                 case when jsonb_typeof(v_p -> k) = 'string' then v_p -> k else 'null'::jsonb end)
          from unnest(array[
            'lesiones', 'operaciones', 'dolores', 'enfermedades', 'diagnostico',
            'historialDeportivo', 'relacionEjercicio', 'actividadDiaria', 'incomodo'
          ]) as k
      )
      || jsonb_build_object(
        'sinAntecedentes', case
            when jsonb_typeof(v_p -> 'sinAntecedentes') is null
              or jsonb_typeof(v_p -> 'sinAntecedentes') = 'null' then null
            else (v_p ->> 'sinAntecedentes') = 'true' end,
        'edadDeclarada', case
            when jsonb_typeof(v_p -> 'edad') in ('number', 'string') then v_p -> 'edad' end
      );
  end if;

  -- Notas y diario (más recientes primero, con límite)
  select count(*) into v_notes_total
    from public.client_notes n where n.user_id = p_client_id;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc, n.id), '[]'::jsonb)
    into v_notes
    from (
      select cn.id, cn.note, cn.created_at
        from public.client_notes cn
       where cn.user_id = p_client_id
       order by cn.created_at desc, cn.id
       limit v_notes_lim offset v_notes_off
    ) n;

  select count(*) into v_journal_total
    from public.client_journal j where j.user_id = p_client_id;

  select coalesce(jsonb_agg(to_jsonb(j) order by j.entry_date desc, j.id), '[]'::jsonb)
    into v_journal
    from (
      select cj.id, cj.body, cj.entry_date, cj.kind, cj.updated_at
        from public.client_journal cj
       where cj.user_id = p_client_id
       order by cj.entry_date desc, cj.id
       limit v_journal_lim offset v_journal_off
    ) j;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_profile.id,
      'nombre', v_profile.nombre,
      'active', v_profile.active,
      'updated_at', v_profile.updated_at,
      'birth_date', v_profile.birth_date,
      'age', case when v_profile.birth_date is null then null
                  else date_part('year', age(v_today, v_profile.birth_date::date))::int end,
      'sex', null::text
    ),
    'active_bonos', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
        from jsonb_array_elements(v_bonos) x
       where x ->> 'status' = 'active'
         and left(x ->> 'service_month', 7) = v_month
         and x ->> 'payment_validated_at' is not null
    ),
    'bonos', v_bonos,
    'history', v_history,
    'this_week', jsonb_build_object(
      'starts_on', v_monday,
      'count', jsonb_array_length(v_week),
      'sessions', v_week
    ),
    'latest_form', v_latest_form,
    'form_match', case
        when not v_unique then 'ambiguous_email'
        when v_has_form then 'matched'
        else 'missing' end,
    'notes', v_notes,
    'journal', v_journal,
    'totals', jsonb_build_object(
      'history', v_hist_total,
      'notes', v_notes_total,
      'journal', v_journal_total
    ),
    'snapshot_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo usuarios autenticados (y dentro, solo admin por RLS + comprobación)
-- ---------------------------------------------------------------------------
revoke all on function public.list_clients(int, int)              from public, anon;
revoke all on function public.client_overview(uuid, int, int, int, int, int, int) from public, anon;
grant execute on function public.list_clients(int, int)           to authenticated;
grant execute on function public.client_overview(uuid, int, int, int, int, int, int) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- PRUEBAS (ejecutar por separado en el editor SQL; cambia los UUID)
-- ---------------------------------------------------------------------------
-- 1) Como admin (Bea): debe devolver datos
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"<UUID_BEA>","role":"authenticated"}', true);
-- select public.list_clients();
-- select public.client_overview('<UUID_CLIENTE>');
-- rollback;
--
-- 2) Como cliente sin rol admin: debe fallar con "forbidden"
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"<UUID_CLIENTE>","role":"authenticated"}', true);
-- select public.list_clients();
-- rollback;
--
-- 3) Como anónimo: debe fallar con "permission denied"
-- begin;
-- set local role anon;
-- select public.list_clients();
-- rollback;

-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO DE VISIBILIDAD (RLS): ejecutar DOS veces y comparar resultados
--   A) como propietario (sin "set local role"): totales reales
--   B) simulando a Bea (con las dos líneas set de abajo): lo que ella ve
-- Si algún número de B es menor que el de A, falta una política o es demasiado
-- restrictiva para esa tabla. Fíjate sobre todo en user_roles_admin: si B no ve
-- todos los administradores, un admin ajeno podría colarse como cliente.
-- ---------------------------------------------------------------------------
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"<UUID_BEA>","role":"authenticated"}', true);
-- select 'user_roles_admin' as tabla, count(*) from public.user_roles where role::text = 'admin'
-- union all select 'profiles',         count(*) from public.profiles
-- union all select 'bookings',         count(*) from public.bookings
-- union all select 'sessions',         count(*) from public.sessions
-- union all select 'attendance',       count(*) from public.attendance
-- union all select 'client_bonos',     count(*) from public.client_bonos
-- union all select 'client_notes',     count(*) from public.client_notes
-- union all select 'client_journal',   count(*) from public.client_journal
-- union all select 'form_submissions', count(*) from public.form_submissions;
-- rollback;
--
-- Paginación: segunda página de historial
-- select public.client_overview('<UUID_CLIENTE>', p_history_offset => 200);