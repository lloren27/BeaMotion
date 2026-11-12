#!/bin/sh
# Requiere PostgreSQL local. Crea y elimina únicamente una base de pruebas nueva.
set -eu
: "${PGHOST:=/private/tmp}"
: "${PGPORT:=55439}"
export PGHOST PGPORT
case "$PGHOST" in /private/tmp|/tmp|127.0.0.1|localhost) ;; *) echo 'Usar únicamente PostgreSQL local' >&2; exit 1;; esac
training_test_db="beamotion_test_$$"
createdb "$training_test_db"
trap 'dropdb --if-exists "$training_test_db"' EXIT
run() { psql -X -v ON_ERROR_STOP=1 -d "$training_test_db" -f "$1"; }
run tests/helpers/local-auth.sql
run supabase/migrations/202611040001_training_plans.sql
run supabase/migrations/202611090001_exercise_catalog.sql
run tests/exercise-catalog-db.sql
run supabase/migrations/202611100001_monthly_models.sql
run tests/monthly-model-db.sql
run supabase/migrations/202611100002_weekly_models.sql
run tests/weekly-model-db.sql
run tests/helpers/legacy-training.sql
run supabase/migrations/202611110001_model_distribution.sql
run tests/model-distribution-db.sql

PGDATABASE="$training_test_db" python3 tests/model-distribution-concurrency.py
