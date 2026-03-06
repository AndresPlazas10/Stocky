#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDER_FILE="$ROOT_DIR/docs/FINAL_DB_MIGRATIONS_ORDER.md"
APPLY_MODE=false
DB_URL="${DATABASE_URL-}"

usage() {
  cat <<USAGE
Uso:
  scripts/apply-final-db-migrations.sh [--apply] [--db-url <DATABASE_URL>] [--order-file <path>]

Comportamiento:
  - Por defecto: dry-run (solo muestra el orden de migraciones).
  - Con --apply: ejecuta las migraciones con psql en el orden definido.

Variables:
  DATABASE_URL   Conexion Postgres (requerida solo con --apply)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY_MODE=true
      shift
      ;;
    --db-url)
      DB_URL="${2-}"
      shift 2
      ;;
    --order-file)
      ORDER_FILE="${2-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: argumento no reconocido: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$ORDER_FILE" ]]; then
  echo "ERROR: no existe archivo de orden: $ORDER_FILE" >&2
  exit 1
fi

ordered_entries=()
while IFS= read -r line; do
  ordered_entries+=("$line")
done < <(rg -o '`[^`]+\.sql`' "$ORDER_FILE" | sed -E 's/^`|`$//g')

if [[ ${#ordered_entries[@]} -eq 0 ]]; then
  echo "ERROR: no se encontraron migraciones en $ORDER_FILE" >&2
  exit 1
fi

migrations=()
for entry in "${ordered_entries[@]}"; do
  if [[ "$entry" == /* ]]; then
    candidate="$entry"
  elif [[ "$entry" == supabase/* ]]; then
    candidate="$ROOT_DIR/$entry"
  else
    candidate="$ROOT_DIR/supabase/migrations/$entry"
  fi

  if [[ ! -f "$candidate" ]]; then
    echo "ERROR: migracion no encontrada: $candidate" >&2
    exit 1
  fi

  migrations+=("$candidate")
done

echo "Orden final de migraciones:"
for i in "${!migrations[@]}"; do
  idx=$((i + 1))
  rel="${migrations[$i]#"$ROOT_DIR/"}"
  echo "  $idx. $rel"
done

if [[ "$APPLY_MODE" != true ]]; then
  echo
  echo "Dry-run completado."
  echo "Para aplicar:"
  echo "  DATABASE_URL='postgres://...' scripts/apply-final-db-migrations.sh --apply"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql no esta instalado en este entorno." >&2
  exit 1
fi

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL es requerido con --apply" >&2
  exit 1
fi

echo
for migration in "${migrations[@]}"; do
  rel="${migration#"$ROOT_DIR/"}"
  echo "Aplicando $rel ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Migraciones finales aplicadas correctamente."
