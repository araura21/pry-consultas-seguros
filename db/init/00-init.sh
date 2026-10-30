#!/bin/sh
# Se ejecuta una sola vez, cuando el volumen de datos está vacío.
# Pasa la contraseña del usuario de la aplicación como variable de psql
# para no escribirla dentro del archivo SQL.
set -e
psql -v ON_ERROR_STOP=1 -v app_pass="$APP_DB_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /sql/schema.sql
