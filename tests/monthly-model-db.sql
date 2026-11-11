\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012');
insert into public.training_admins(user_id) values ('00000000-0000-0000-0000-000000000011');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select public.create_monthly_models('2026-11-01', false);
do $$
declare v_model_id uuid; rev integer; snapshot jsonb;
begin
 if (select count(*) from public.monthly_training_models where period_month = '2026-11-01') <> 3 then raise exception 'No se crearon tres modelos'; end if;
 select id into v_model_id from public.monthly_training_models where period_month = '2026-11-01' and model_code='A';
 begin perform public.publish_monthly_model(v_model_id, 0); raise exception 'Se publicó un modelo incompleto'; exception when raise_exception then if sqlerrm = 'Se publicó un modelo incompleto' then raise; end if; end;
 rev := public.save_monthly_model_draft(v_model_id, 0, '[{"name":"Press","patterns":["core","empuje superior","tracción inferior"],"load":"8 kg"}]');
 if public.publish_monthly_model(v_model_id, rev) <> 1 then raise exception 'Versión incorrecta'; end if;
 perform public.create_monthly_models('2026-12-01', true);
 update public.monthly_training_models set draft='[{"name":"Copia","patterns":[]}]' where period_month='2026-12-01' and model_code='A';
 if (select draft->0->>'name' from public.monthly_training_models where id=v_model_id) <> 'Press' then raise exception 'La copia alteró el original'; end if;
 perform public.save_monthly_model_draft(v_model_id, rev, '[{"name":"Nuevo","patterns":["core","empuje superior","tracción inferior"]}]');
 select v.snapshot into snapshot from public.monthly_model_versions v where v.model_id=v_model_id and v.version_number=1;
 if snapshot->0->>'name' <> 'Press' then raise exception 'La versión publicada cambió'; end if;
 begin perform public.save_monthly_model_draft(v_model_id, rev, '[]'); raise exception 'Se aceptó revisión obsoleta'; exception when serialization_failure then null; end;
 begin update public.monthly_model_versions set snapshot='[]' where monthly_model_versions.model_id=v_model_id; raise exception 'Se modificó versión publicada'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
do $$ begin
 if (select count(*) from public.monthly_training_models) <> 0 then raise exception 'RLS permite leer modelos'; end if;
 begin perform public.create_monthly_models('2027-01-01', false); raise exception 'RLS permite crear modelos'; exception when insufficient_privilege then null; end;
end $$;
rollback;
