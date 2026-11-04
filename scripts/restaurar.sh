#!/bin/sh
# Restaura un respaldo cifrado (P20). Uso: sh scripts/restaurar.sh respaldos/<archivo>.sql.gz.enc
set -e
[ -f "$1" ] || { echo "Uso: sh scripts/restaurar.sh <archivo>"; exit 1; }
set -a; . ./.env; set +a
INICIO=$(date +%s)
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSWORD -in "$1" \
  | gunzip | docker exec -i consultas-db psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null
echo "Restauración terminada en $(( $(date +%s) - INICIO )) segundos"
