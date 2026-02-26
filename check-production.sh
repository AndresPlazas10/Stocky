#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ok() {
  printf "✅ %s\n" "$1"
}

warn() {
  printf "⚠️  %s\n" "$1"
}

fail() {
  printf "❌ %s\n" "$1"
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Falta comando requerido: $cmd"
}

check_required_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "Falta archivo requerido: $file"
  ok "Archivo presente: $file"
}

check_key_in_file() {
  local key="$1"
  local file="$2"
  rg -n "^${key}=" "$file" >/dev/null 2>&1 || fail "Falta variable ${key} en ${file}"
}

echo "== Preflight Produccion =="

require_cmd node
require_cmd npm
require_cmd git
require_cmd rg
ok "Herramientas base disponibles"

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
NPM_MAJOR="$(npm -v | cut -d. -f1)"

(( NODE_MAJOR >= 18 )) || fail "Node.js >= 18 requerido (actual: $(node -v))"
(( NPM_MAJOR >= 9 )) || fail "npm >= 9 requerido (actual: $(npm -v))"
ok "Versiones compatibles: Node $(node -v), npm $(npm -v)"

check_required_file "package.json"
check_required_file "vercel.json"
check_required_file ".env.production.example"
check_required_file "vite.config.js"
check_required_file "supabase/migrations/20260226_0100_harden_realtime_publication_and_rls.sql"
check_required_file "supabase/migrations/20260226_0200_fix_businesses_created_at.sql"

if git ls-files --error-unmatch ".env.production" >/dev/null 2>&1; then
  fail ".env.production esta trackeado en git. Debe permanecer solo local."
fi
ok ".env.production no esta trackeado en git"

if rg -n "^(<<<<<<<|=======|>>>>>>>)" src api >/dev/null 2>&1; then
  fail "Se detectaron marcadores de conflicto de merge en src/ o api/"
fi
ok "Sin marcadores de conflicto"

check_key_in_file "VITE_SUPABASE_URL" ".env.production.example"
check_key_in_file "VITE_SUPABASE_ANON_KEY" ".env.production.example"
check_key_in_file "VITE_APP_URL" ".env.production.example"
check_key_in_file "RESEND_API_KEY" ".env.production.example"
check_key_in_file "RESEND_FROM_EMAIL" ".env.production.example"
check_key_in_file "VITE_FF_LOCAL_FIRST_ALL" ".env.production.example"
check_key_in_file "VITE_FF_LOCAL_FIRST_ORDERS" ".env.production.example"
check_key_in_file "VITE_FF_LOCAL_FIRST_TABLES" ".env.production.example"
ok "Template de variables de produccion verificado"

if [[ ! -f ".env" ]]; then
  warn "No existe .env local. Para pruebas locales crea uno basado en .env.example"
else
  if rg -n "^VITE_SUPABASE_URL=" ".env" >/dev/null 2>&1 && rg -n "^VITE_SUPABASE_ANON_KEY=" ".env" >/dev/null 2>&1; then
    ok ".env local contiene claves minimas de Supabase"
  else
    warn ".env local no tiene todas las claves minimas de Supabase"
  fi

  if rg -n "^VITE_FF_LOCAL_FIRST_.*=true$" ".env" >/dev/null 2>&1; then
    warn "Tu .env local tiene local-first forzado activo (VITE_FF_LOCAL_FIRST_*=true). Para Realtime estable en producción se recomienda false."
  else
    ok "Sin local-first forzado en .env local"
  fi
fi

echo
echo "== Ejecutando pipeline predeploy =="
npm run predeploy

echo
ok "Preflight completado. Proyecto listo para deploy a produccion."
echo "Siguiente paso sugerido: vercel --prod"
