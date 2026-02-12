#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL-}" ]; then
  echo "ERROR: Please export DATABASE_URL with a superuser/service_role connection string."
  echo "Example: export DATABASE_URL='postgres://user:pass@host:5432/dbname'"
  exit 1
fi

# Owner role to assign to the function. Default to 'postgres' but you can set SERVICE_ROLE to your Supabase service role.
SERVICE_ROLE="${SERVICE_ROLE-postgres}"

cat <<SQL | psql "$DATABASE_URL"
ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) OWNER TO ${SERVICE_ROLE};
ALTER FUNCTION public.handle_table_transaction(uuid,text,uuid,text) SET search_path = public;
GRANT EXECUTE ON FUNCTION public.handle_table_transaction(uuid,text,uuid,text) TO authenticated;
SQL

echo "Done. Function owner set to '${SERVICE_ROLE}' and GRANT EXECUTE applied."
echo "Verify owner and privileges with:"
echo "psql \"$DATABASE_URL\" -c \"SELECT n.nspname AS schema, p.proname AS name, pg_get_userbyid(p.proowner) AS owner FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'handle_table_transaction';\""
