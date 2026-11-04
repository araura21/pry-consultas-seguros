#!/bin/sh
# Respaldo cifrado de la base de datos (R08). Uso, desde la raíz: sh scripts/respaldo.sh
set -e
set -a; . ./.env; set +a
mkdir -p respaldos
ARCHIVO="respaldos/consultas-$(date +%Y%m%d-%H%M%S).sql.gz.enc"
docker exec consultas-db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSWORD -out "$ARCHIVO"
echo "Respaldo cifrado creado: $ARCHIVO"
