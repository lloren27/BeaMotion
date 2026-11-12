-- Solo Supabase propio. No ejecutar en Lovable.
begin;
create function public.model_patterns(p_code text) returns text[] language sql immutable as $$
 select case p_code when 'A' then array['core','empuje superior','tracción inferior']
 when 'B' then array['core','tracción superior','tracción inferior']
 when 'C' then array['core','empuje superior','empuje inferior','tracción superior','tracción inferior'] else array[]::text[] end;
$$;
create function public.validate_model_exercises() returns trigger language plpgsql as $$
begin
 if jsonb_typeof(new.draft) is distinct from 'array' then raise exception 'Borrador no válido' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(new.draft) e where
   jsonb_typeof(e->'patterns') is distinct from 'array' or not coalesce((e->'patterns') ?| public.model_patterns(new.model_code),false)
   or length(trim(coalesce(e->>'name','')))=0) then
   raise exception 'Cada ejercicio necesita un nombre y al menos un patrón del modelo' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validate_model_exercises before insert or update of draft,model_code on public.monthly_training_models
 for each row execute function public.validate_model_exercises();

alter table public.training_monthly_plans add column source_bono_id uuid, add column bookings_observed_at timestamptz;
alter table public.training_sessions
 add column booking_id uuid unique,
 add column scheduled_date date,
 add column attendance_confirmed boolean not null default false,
 add column booking_active boolean not null default false,
 add column source_version_id uuid references public.monthly_model_versions(id),
 add column personalized boolean not null default false,
 add column revision integer not null default 0;
alter table public.training_exercises
 add column patterns text[] not null default '{}',
 add column material text,
 add column adaptation text;
alter table public.training_sets add column duration text, add column planned_series text;
update public.training_sessions s set personalized=true where exists(select 1 from public.training_exercises e where e.session_id=s.id);

-- Invoker: las escrituras administrativas ordinarias marcan personalización.
-- Las funciones internas SECURITY DEFINER son las únicas que realizan copias sin marcarla.
create function public.track_session_edit() returns trigger language plpgsql security invoker set search_path=public as $$
declare sid uuid; owner_name text;
begin
 select pg_get_userbyid(relowner) into owner_name from pg_class where oid='public.training_sessions'::regclass;
 if current_user=owner_name then return coalesce(new,old); end if;
 if tg_table_name='training_exercises' then sid:=case when tg_op='DELETE' then old.session_id else new.session_id end;
 else select session_id into sid from public.training_exercises where id=case when tg_op='DELETE' then old.exercise_id else new.exercise_id end; end if;
 update public.training_sessions set personalized=true,revision=revision+1 where id=sid;
 if not found then raise exception 'La sesión cambió. Recarga antes de guardar.' using errcode='40001'; end if;
 return coalesce(new,old);
end $$;
create trigger track_exercise_edit before insert or update or delete on public.training_exercises for each row execute function public.track_session_edit();
create trigger track_set_edit before insert or update or delete on public.training_sets for each row execute function public.track_session_edit();

create function public.track_session_status() returns trigger language plpgsql security invoker set search_path=public as $$
declare owner_name text;
begin
 select pg_get_userbyid(relowner) into owner_name from pg_class where oid='public.training_sessions'::regclass;
 if current_user<>owner_name and (new.status is distinct from old.status or new.session_date is distinct from old.session_date) then
  new.revision:=old.revision+1; new.personalized:=true;
 end if;
 return new;
end $$;
create trigger track_session_status before update of status,session_date on public.training_sessions for each row execute function public.track_session_status();

-- Serialización por mes entre publicación y sincronización de reservas.
create function public.sync_bookings_internal(p_month date,p_clients jsonb,p_observed_at timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c jsonb; b jsonb; plan public.training_monthly_plans%rowtype; s public.training_sessions%rowtype;
 sid uuid; problems jsonb:='[]'; ambiguous boolean; used_numbers integer[]; last_number integer; candidate integer;
begin
 if p_month is null or extract(day from p_month)<>1 or jsonb_typeof(p_clients) is distinct from 'array' then raise exception 'Sincronización no válida'; end if;
 perform pg_advisory_xact_lock(hashtextextended('training:'||p_month::text,0));
 if (select count(*) from jsonb_array_elements(p_clients))<>(select count(distinct value->>'client_id') from jsonb_array_elements(p_clients)) then raise exception 'Clientes duplicados'; end if;
 for c in select value from jsonb_array_elements(p_clients) loop
  if c->>'client_id' is null or c->>'bono_id' is null or coalesce((c->>'session_count')::int,0) not in (4,8,12)
     or jsonb_typeof(c->'bookings') is distinct from 'array' then raise exception 'Bono o reservas no válidos'; end if;
  if exists(select 1 from jsonb_array_elements(c->'bookings') x where x->>'id' is null or x->>'date' is null
    or date_trunc('month',(x->>'date')::date)::date<>p_month or jsonb_typeof(x->'active') is distinct from 'boolean' or jsonb_typeof(x->'attended') is distinct from 'boolean')
    or (select count(*) from jsonb_array_elements(c->'bookings'))<>(select count(distinct value->>'id') from jsonb_array_elements(c->'bookings')) then raise exception 'Reservas no válidas'; end if;
  if (select count(*) from jsonb_array_elements(c->'bookings') x where (x->>'active')::boolean or (x->>'attended')::boolean)>(c->>'session_count')::int then
   problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','Más reservas que sesiones del bono')); continue;
  end if;
  select * into plan from public.training_monthly_plans where client_id=(c->>'client_id')::uuid and period_month=p_month for update;
  if found and (plan.session_count<>(c->>'session_count')::int or (plan.source_bono_id is not null and plan.source_bono_id<>(c->>'bono_id')::uuid)) then
   problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','El bono no coincide con el plan existente')); continue;
  end if;
  if plan.id is null then
   perform public.create_training_monthly_plan((c->>'client_id')::uuid,p_month,(c->>'session_count')::smallint);
   select * into plan from public.training_monthly_plans where client_id=(c->>'client_id')::uuid and period_month=p_month for update;
  end if;
  if plan.bookings_observed_at>p_observed_at then raise exception 'Otra consulta actualizó las reservas. Vuelve a consultar.' using errcode='40001'; end if;
  perform 1 from public.training_sessions where plan_id=plan.id order by id for update;
  -- Historial antiguo: solo enlazar realizadas si hay una correspondencia inequívoca por fecha.
  ambiguous:=false;
  for s in select * from public.training_sessions where plan_id=plan.id and booking_id is null and status<>'pending' loop
   if s.status<>'completed' or (select count(*) from jsonb_array_elements(c->'bookings') x where (x->>'attended')::boolean and (x->>'date')::date=s.session_date)<>1
     or (select count(*) from public.training_sessions where plan_id=plan.id and status='completed' and session_date=s.session_date)<>1 then ambiguous:=true; end if;
  end loop;
  if ambiguous then
   problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','Historial sin vínculo inequívoco con las reservas')); continue;
  end if;
  -- Comprobar el orden antes de tocar vínculos. Nunca cambiar la letra de una sesión existente.
  used_numbers:='{}'; last_number:=0; ambiguous:=false;
  for b in select value from jsonb_array_elements(c->'bookings') with ordinality as rows(value,position)
    where (value->>'active')::boolean or (value->>'attended')::boolean order by value->>'date',position loop
   select session_number into candidate from public.training_sessions where plan_id=plan.id
    and (booking_id=(b->>'id')::uuid or (booking_id is null and status='completed' and session_date=(b->>'date')::date and (b->>'attended')::boolean));
   if candidate is null then
    select session_number into candidate from public.training_sessions ts where plan_id=plan.id and status='pending'
     and not (session_number=any(used_numbers)) and (booking_id is null or
      (not personalized and scheduled_date>=(now() at time zone 'Europe/Madrid')::date and not exists(
       select 1 from jsonb_array_elements(c->'bookings') x where (x->>'id')::uuid=ts.booking_id and ((x->>'active')::boolean or (x->>'attended')::boolean))))
     order by session_number limit 1;
   end if;
   if candidate is null or candidate<=last_number then ambiguous:=true; exit; end if;
   used_numbers:=array_append(used_numbers,candidate); last_number:=candidate;
  end loop;
  if ambiguous then
   problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','El orden de reservas no coincide con la secuencia del plan. Revisa las reservas antes de distribuir')); continue;
  end if;
  update public.training_monthly_plans set source_bono_id=(c->>'bono_id')::uuid,bookings_observed_at=p_observed_at where id=plan.id;
  for s in select * from public.training_sessions where plan_id=plan.id and booking_id is null and status='completed' loop
   select value into b from jsonb_array_elements(c->'bookings') x where (x->>'attended')::boolean and (x->>'date')::date=s.session_date;
   update public.training_sessions set booking_id=(b->>'id')::uuid,scheduled_date=(b->>'date')::date,attendance_confirmed=true,booking_active=false,revision=revision+1 where id=s.id;
  end loop;
  -- Las reservas desaparecidas/canceladas liberan únicamente copias pendientes intactas.
  for s in select * from public.training_sessions where plan_id=plan.id and booking_id is not null loop
   select value into b from jsonb_array_elements(c->'bookings') x where (x->>'id')::uuid=s.booking_id;
   if b is null or not ((b->>'active')::boolean or (b->>'attended')::boolean) then
    if s.status='pending' and not s.personalized and s.scheduled_date >= (now() at time zone 'Europe/Madrid')::date then
     delete from public.training_exercises where session_id=s.id;
     update public.training_sessions set booking_id=null,scheduled_date=null,booking_active=false,source_version_id=null,revision=revision+1 where id=s.id;
    else update public.training_sessions set booking_active=false where id=s.id; end if;
   end if;
  end loop;
  for b in select value from jsonb_array_elements(c->'bookings') with ordinality as rows(value,position) where (value->>'active')::boolean or (value->>'attended')::boolean order by value->>'date',position loop
   select * into s from public.training_sessions where plan_id=plan.id and booking_id=(b->>'id')::uuid;
   if not found then
    select * into s from public.training_sessions where plan_id=plan.id and booking_id is null and status='pending' order by session_number limit 1;
    if not found then
     problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','No hay sesión disponible para la reserva')); continue;
    end if;
   end if;
   if s.scheduled_date is not null and s.scheduled_date<>(b->>'date')::date and (s.personalized or s.status<>'pending' or s.scheduled_date<(now() at time zone 'Europe/Madrid')::date) then
    update public.training_sessions set booking_active=false where id=s.id;
    problems:=problems||jsonb_build_array(jsonb_build_object('client_id',c->>'client_id','reason','Reserva reprogramada con contenido protegido')); continue;
   end if;
   if s.source_version_id is not null and not s.personalized and s.status='pending' and not (b->>'attended')::boolean
     and exists(select 1 from public.monthly_model_versions mv join public.monthly_training_models m on m.id=mv.model_id
      where mv.id=s.source_version_id and m.week_number<>((extract(isodow from p_month)::int-1+extract(day from (b->>'date')::date)::int-1)/7)+1) then
    delete from public.training_exercises where session_id=s.id;
    update public.training_sessions set source_version_id=null where id=s.id;
   end if;
   update public.training_sessions set booking_id=(b->>'id')::uuid,scheduled_date=(b->>'date')::date,
    attendance_confirmed=(b->>'attended')::boolean,booking_active=(b->>'active')::boolean,
    status=case when (b->>'attended')::boolean then 'completed' else status end,
    session_date=case when (b->>'attended')::boolean then (b->>'date')::date else session_date end,
    completed_at=case when (b->>'attended')::boolean then coalesce(completed_at,now()) else completed_at end,
    not_completed_reason=case when (b->>'attended')::boolean then null else not_completed_reason end,
    revision=revision+1 where id=s.id;
  end loop;
 end loop;
 return problems;
end $$;

create function public.distribute_models_internal(p_month date,p_clients jsonb,p_model uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s record; v public.monthly_model_versions%rowtype; e jsonb; eid uuid; pos integer; distributed integer:=0; protected integer:=0; pending integer:=0;
begin
 for s in select ts.*,p.period_month from public.training_sessions ts join public.training_monthly_plans p on p.id=ts.plan_id
 where p.period_month=p_month and p.client_id in(select (value->>'client_id')::uuid from jsonb_array_elements(p_clients))
 and ts.booking_id is not null order by ts.id for update of ts loop
  if s.status<>'pending' or s.personalized or not s.booking_active or s.scheduled_date<(now() at time zone 'Europe/Madrid')::date then protected:=protected+1; continue; end if;
  if exists(select 1 from public.training_exercises x join public.training_sets z on z.exercise_id=x.id where x.session_id=s.id and
    (z.actual_series_count is not null or z.actual_repetitions is not null or z.actual_rest is not null or z.actual_load is not null or z.actual_notes is not null)) then protected:=protected+1; continue; end if;
  select mv.* into v from public.monthly_model_versions mv join public.monthly_training_models m on m.id=mv.model_id
   where m.period_month=p_month and m.model_code=s.model_code
    and m.week_number=((extract(isodow from p_month)::int-1+extract(day from s.scheduled_date)::int-1)/7)+1
    and (p_model is null or m.id=p_model) order by mv.version_number desc limit 1;
  if v.id is null then
   -- Una reserva movida a otra semana no conserva una copia de la semana anterior.
   if p_model is null and s.source_version_id is not null then
    delete from public.training_exercises where session_id=s.id;
    update public.training_sessions set source_version_id=null,revision=revision+1 where id=s.id;
   end if;
   pending:=pending+1; continue;
  end if;
  if s.source_version_id=v.id then continue; end if;
  delete from public.training_exercises where session_id=s.id;
  pos:=0;
  for e in select value from jsonb_array_elements(v.snapshot) loop
   insert into public.training_exercises(session_id,position,name,notes,patterns,material,adaptation)
    values(s.id,pos,e->>'name',nullif(e->>'description',''),array(select jsonb_array_elements_text(e->'patterns')),nullif(e->>'material',''),nullif(e->>'adaptation','')) returning id into eid;
   insert into public.training_sets(exercise_id,position,planned_series,repetitions,duration,rest,load)
    values(eid,0,nullif(e->>'series',''),nullif(e->>'repetitions',''),nullif(e->>'duration',''),nullif(e->>'rest',''),nullif(e->>'load',''));
   pos:=pos+1;
  end loop;
  update public.training_sessions set source_version_id=v.id,revision=revision+1 where id=s.id;
  distributed:=distributed+1;
 end loop;
 return jsonb_build_object('distributed',distributed,'protected',protected,'pending',pending);
end $$;

alter function public.publish_monthly_model(uuid,integer) rename to publish_monthly_model_internal;
revoke all on function public.publish_monthly_model_internal(uuid,integer) from public,anon,authenticated;
create function public.check_booking_snapshot(p_observed_at timestamptz) returns void language plpgsql security invoker as $$
begin
 if not public.is_training_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 if p_observed_at is null or p_observed_at<clock_timestamp()-interval '5 minutes' or p_observed_at>clock_timestamp()+interval '1 minute' then raise exception 'Las reservas han caducado. Vuelve a consultar.' using errcode='40001'; end if;
end $$;
create function public.sync_training_bookings(p_month date,p_clients jsonb,p_observed_at timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare excluded jsonb; eligible jsonb;
begin
 perform public.check_booking_snapshot(p_observed_at);
 excluded:=public.sync_bookings_internal(p_month,p_clients,p_observed_at);
 select coalesce(jsonb_agg(c),'[]') into eligible from jsonb_array_elements(p_clients) c where not exists(select 1 from jsonb_array_elements(excluded) x where x->>'client_id'=c->>'client_id');
 return public.distribute_models_internal(p_month,eligible)||jsonb_build_object('excluded',excluded);
end $$;
create function public.publish_model_with_bookings(p_id uuid,p_revision integer,p_clients jsonb,p_observed_at timestamptz) returns jsonb
language plpgsql security definer set search_path=public as $$
declare m public.monthly_training_models%rowtype; excluded jsonb; eligible jsonb; version integer;
begin
 perform public.check_booking_snapshot(p_observed_at);
 select * into m from public.monthly_training_models where id=p_id;
 if not found then raise exception 'Modelo no disponible'; end if;
 perform pg_advisory_xact_lock(hashtextextended('training:'||m.period_month::text,0));
 select * into m from public.monthly_training_models where id=p_id for update;
 if m.revision<>p_revision then raise exception 'El modelo cambió. Recarga antes de publicar.' using errcode='40001'; end if;
 if exists(select 1 from jsonb_array_elements(m.draft) e where not coalesce((e->'patterns') ?| public.model_patterns(m.model_code),false)) then raise exception 'El modelo contiene ejercicios incompatibles' using errcode='23514'; end if;
 excluded:=public.sync_bookings_internal(m.period_month,p_clients,p_observed_at);
 select version_number into version from public.monthly_model_versions where model_id=p_id and snapshot=m.draft order by version_number desc limit 1;
 if version is null or version<>(select max(version_number) from public.monthly_model_versions where model_id=p_id) then version:=public.publish_monthly_model_internal(p_id,p_revision); end if;
 select coalesce(jsonb_agg(c),'[]') into eligible from jsonb_array_elements(p_clients) c where not exists(select 1 from jsonb_array_elements(excluded) x where x->>'client_id'=c->>'client_id');
 return public.distribute_models_internal(m.period_month,eligible,p_id)||jsonb_build_object('version',version,'excluded',excluded);
end $$;

-- Guardado completo y con revisión: una pantalla anterior a una distribución no pierde cambios silenciosamente.
create function public.save_training_exercise(p_session_id uuid,p_revision integer,p_exercise jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare s public.training_sessions%rowtype; z jsonb; eid uuid:=(p_exercise->>'id')::uuid;
begin
 select * into s from public.training_sessions where id=p_session_id for update;
 if not found or s.revision<>p_revision then raise exception 'La sesión cambió. Recarga antes de guardar.' using errcode='40001'; end if;
 update public.training_exercises set name=trim(p_exercise->>'name'),notes=p_exercise->>'notes',material=p_exercise->>'material',adaptation=p_exercise->>'adaptation'
  where id=eid and session_id=p_session_id;
 if not found then raise exception 'El ejercicio cambió. Recarga antes de guardar.' using errcode='40001'; end if;
 if jsonb_typeof(p_exercise->'sets') is distinct from 'array' then raise exception 'Series no válidas'; end if;
 for z in select value from jsonb_array_elements(p_exercise->'sets') loop
  update public.training_sets set series_count=nullif(z->>'series_count','')::smallint,planned_series=z->>'planned_series',repetitions=z->>'repetitions',duration=z->>'duration',rest=z->>'rest',load=z->>'load',
   actual_series_count=z->>'actual_series_count',actual_repetitions=z->>'actual_repetitions',actual_rest=z->>'actual_rest',actual_load=z->>'actual_load',actual_notes=z->>'actual_notes'
   where id=(z->>'id')::uuid and exercise_id=eid;
  if not found then raise exception 'Las series cambiaron. Recarga antes de guardar.' using errcode='40001'; end if;
 end loop;
end $$;
revoke all on function public.sync_bookings_internal(date,jsonb,timestamptz),public.distribute_models_internal(date,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.sync_training_bookings(date,jsonb,timestamptz),public.publish_model_with_bookings(uuid,integer,jsonb,timestamptz),public.save_training_exercise(uuid,integer,jsonb) from public,anon;
grant execute on function public.sync_training_bookings(date,jsonb,timestamptz),public.publish_model_with_bookings(uuid,integer,jsonb,timestamptz),public.save_training_exercise(uuid,integer,jsonb) to authenticated;
commit;
