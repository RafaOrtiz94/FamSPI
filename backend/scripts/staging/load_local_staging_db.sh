#!/usr/bin/env bash
# Carga la base LOCAL de staging (PostgreSQL 17, puerto 5544) desde la copia ya saneada que vive
# en el proyecto de Neon de staging. No lee produccion.
#
# Uso (Git Bash, desde cualquier carpeta):  bash backend/scripts/staging/load_local_staging_db.sh
# Requiere: gcloud autenticado (secreto DB_URL_STAGING) y la instancia local arrancada
# (scripts/staging_local.ps1 -Action db).
set -u
PGBIN="/c/Program Files/PostgreSQL/18/bin"   # cliente 18: el origen (Neon staging) es servidor 18
BASE="$LOCALAPPDATA/FamSPI-staging"
DUMP="$BASE/staging_dump"   # formato directorio: una tabla por archivo, respaldo en paralelo
LOCAL=(--host localhost --port 5544 --username famspi_staging --dbname famspi_staging)
step() { echo "== $1 ($(date +%H:%M:%S))"; }

URL="$(gcloud secrets versions access latest --secret=DB_URL_STAGING --project=famspi-sbox 2>/dev/null < /dev/null)"
[ -n "$URL" ] || { echo "No se pudo leer DB_URL_STAGING"; exit 1; }
eval "$(node -e "const u=new URL(process.argv[1]);console.log('SH='+u.hostname.replace('-pooler','')+' SU='+u.username+' SD='+u.pathname.slice(1)+' SP='+JSON.stringify(decodeURIComponent(u.password)))" "$URL")"
case "$SH" in *muddy-sun*|*wispy-moon*|*lucky-bar*) echo "ABORTADO: el origen es produccion o un relevo"; exit 1;; esac

rm -rf "$DUMP"
step "respaldo desde $SH/$SD"
PGPASSWORD="$SP" PGSSLMODE=require "$PGBIN/pg_dump.exe" --host "$SH" --port 5432 --username "$SU" --dbname "$SD" \
  --format=directory --jobs 4 --no-owner --no-privileges --file "$DUMP" < /dev/null || { echo "pg_dump fallo"; exit 1; }
echo "respaldo: $(du -sh "$DUMP" | cut -f1)"

export PGPASSWORD="$(cat "$BASE/db_password.txt")"
step "limpiando base local"
"$PGBIN/psql.exe" "${LOCAL[@]}" -v ON_ERROR_STOP=1 -q < /dev/null \
  -c "DROP SCHEMA IF EXISTS public, servicio, crm, work_management, external_world_cup_2026, auditoria CASCADE; CREATE SCHEMA public;" || exit 1

step "restaurando en local"
"$PGBIN/pg_restore.exe" "${LOCAL[@]}" --no-owner --no-privileges --jobs 4 "$DUMP" < /dev/null 2>&1 | tail -15
echo "pg_restore exit=${PIPESTATUS[0]}"

rm -rf "$DUMP"
step "verificacion"
"$PGBIN/psql.exe" "${LOCAL[@]}" -tA < /dev/null -c "SELECT 'tablas=' || (SELECT COUNT(*) FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')) || ' usuarios=' || (SELECT COUNT(*) FROM users) || ' prueba=' || (SELECT COUNT(*) FROM users WHERE username LIKE 'prueba.%') || ' correos_reales=' || (SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@staging.invalid') || ' size=' || pg_size_pretty(pg_database_size(current_database()))"
step "fin"
