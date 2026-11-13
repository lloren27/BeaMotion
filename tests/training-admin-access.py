"""Prueba local del alta: rechazos sin permisos e idempotencia."""
import os
from pathlib import Path
import subprocess

env = {**os.environ, "PGHOST": os.environ.get("PGHOST", "/private/tmp"),
       "PGPORT": os.environ.get("PGPORT", "55439")}
assert env["PGHOST"] in ("/private/tmp", "/tmp", "127.0.0.1", "localhost")
database = f"beamotion_admin_test_{os.getpid()}"


def sql(source):
    return subprocess.run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
                           "-d", database], input=source, text=True,
                          capture_output=True, env=env)


subprocess.run(["createdb", database], env=env, check=True)
try:
    setup = sql("""
      create schema auth;
      create table auth.users (id uuid primary key, email text,
        email_confirmed_at timestamptz, banned_until timestamptz);
      create table public.training_admins (
        user_id uuid primary key references auth.users(id));
      insert into auth.users values
        ('00000000-0000-0000-0000-000000000001', 'admin@example.test', now(), null),
        ('00000000-0000-0000-0000-000000000002', 'pending@example.test', null, null),
        ('00000000-0000-0000-0000-000000000003', 'banned@example.test', now(), now() + interval '1 day');
    """)
    assert setup.returncode == 0, setup.stderr
    path = Path(__file__).resolve().parents[1] / "scripts/grant_training_admin.sql"
    source = path.read_text() if path.exists() else ""
    for email in ("CORREO_ADMIN", "missing@example.test", "pending@example.test", "banned@example.test"):
        result = sql(source.replace("CORREO_ADMIN", email))
        assert result.returncode != 0, f"Debe rechazar {email}"
        assert sql("select count(*) from public.training_admins").stdout.strip() == "0"
    for _ in range(2):
        result = sql(source.replace("CORREO_ADMIN", " ADMIN@example.test "))
        assert result.returncode == 0, result.stderr
        assert sql("select user_id from public.training_admins").stdout.strip() == "00000000-0000-0000-0000-000000000001"
    print("OK: sin correo, inexistente, no confirmado, bloqueado y alta repetida.")
finally:
    subprocess.run(["dropdb", database], env=env, check=True)
