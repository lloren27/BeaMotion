#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

node -e "const {submit}=require('./eas.json'); if(!/^\\d+$/.test(submit?.production?.ios?.ascAppId || '')) process.exit(1)" || {
  echo 'Falta submit.production.ios.ascAppId en eas.json.' >&2
  exit 1
}

build_result=$(mktemp)
trap 'rm -f "$build_result"' EXIT HUP INT TERM

echo 'Generando build iOS de producción...'
eas build --platform ios --profile production --non-interactive --wait --json > "$build_result"

build_id=$(node -e '
const fs = require("node:fs");
const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const build = Array.isArray(result) ? result[0] : result;
if (!build || !/^[0-9a-f-]{36}$/i.test(build.id || "") || build.status !== "FINISHED") {
  console.error("La build no terminó correctamente o EAS devolvió un resultado inesperado.");
  process.exit(1);
}
process.stdout.write(build.id);
' "$build_result")

echo "Enviando la build $build_id a TestFlight..."
eas submit --platform ios --profile production --id "$build_id" --non-interactive --wait
