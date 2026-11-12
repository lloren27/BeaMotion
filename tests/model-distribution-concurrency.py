"""Integration tests on the disposable database created by test_training_db.sh."""
import os
import subprocess
import time

PSQL = ['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1']
ADMIN = '00000000-0000-0000-0000-000000000071'
CLIENT = '00000000-0000-0000-0000-000000000072'
CLAIM = f"set role authenticated; select set_config('request.jwt.claim.sub','{ADMIN}',false);"
PAYLOAD = '''[{"client_id":"00000000-0000-0000-0000-000000000072","bono_id":"00000000-0000-0000-0000-000000000073","session_count":8,"bookings":[{"id":"00000000-0000-0000-0000-000000000074","date":"2099-08-01","active":true,"attended":false}]}]'''


def sql(statement):
    result = subprocess.run(PSQL + ['-c', statement], capture_output=True, text=True, check=True)
    return result.stdout.strip().splitlines()


def start(statement, name):
    return subprocess.Popen(PSQL + ['-c', statement], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                            env={**os.environ, 'PGAPPNAME': name})


def finish(process, expected_success=True):
    out, err = process.communicate(timeout=10)
    if (process.returncode == 0) != expected_success:
        raise AssertionError(f'Unexpected transaction result: {out} {err}')
    return err


def wait_for_sleep(name):
    for _ in range(100):
        if sql(f"select count(*) from pg_stat_activity where application_name='{name}' and wait_event='PgSleep'")[-1] == '1':
            return
        time.sleep(.02)
    raise AssertionError('Transaction did not acquire its locks')


sql(f"insert into auth.users(id) values ('{ADMIN}'); insert into training_admins(user_id) values ('{ADMIN}'); {CLAIM} select create_monthly_models('2099-08-01',false);")
model = sql("select id from monthly_training_models where period_month='2099-08-01' and week_number=1 and model_code='A'")[-1]
sql(f'''{CLAIM} select save_monthly_model_draft('{model}',0,'[{{"name":"Base","patterns":["core","empuje superior","tracción inferior"]}}]');''')
observed = sql('select clock_timestamp()')[-1]
publish = f"{CLAIM} select publish_model_with_bookings('{model}',1,'{PAYLOAD}','{observed}');"
# Two devices publishing and generating a new plan simultaneously.
a, b = start(publish, 'sprint3-publisher-a'), start(publish, 'sprint3-publisher-b')
finish(a)
finish(b)
assert sql(f"select count(*) from training_monthly_plans where client_id='{CLIENT}'")[-1] == '1'
assert sql(f"select count(*) from monthly_model_versions where model_id='{model}'")[-1] == '1'
session = sql("select id from training_sessions where booking_id='00000000-0000-0000-0000-000000000074'")[-1]
exercise = sql(f"select id from training_exercises where session_id='{session}'")[-1]
assert sql(f"select count(*) from training_exercises where session_id='{session}'")[-1] == '1'
sql(f'''{CLAIM} select save_monthly_model_draft('{model}',1,'[{{"name":"Nuevo","patterns":["core","empuje superior","tracción inferior"]}}]');''')
# Individual edit wins the session lock; distribution must preserve it after waiting.
editor = start(f"begin; {CLAIM} update training_exercises set name='Personalizado concurrente' where id='{exercise}'; select pg_sleep(1); commit;", 'sprint3-editor')
wait_for_sleep('sprint3-editor')
publisher = start(f"{CLAIM} select publish_model_with_bookings('{model}',2,'{PAYLOAD}',clock_timestamp());", 'sprint3-publisher')
finish(editor)
finish(publisher)
assert sql(f"select name from training_exercises where id='{exercise}'")[-1] == 'Personalizado concurrente'
# Old snapshots must not overwrite a later successful synchronization.
err = finish(start(publish, 'sprint3-obsolete-snapshot'), expected_success=False)
assert 'cambió' in err or 'actualizó las reservas' in err
print('Concurrency: simultaneous publication idempotent; concurrent customization preserved; stale operation rejected.')
