-- Seguridad Stocky: auditoria rapida de RLS y funciones sensibles
-- Requiere ejecutar con un rol que pueda leer catalogos del schema public.

\echo '== Tablas public sin RLS habilitado =='
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = false
ORDER BY 1, 2;

\echo ''
\echo '== Policies public con USING/WITH CHECK siempre true =='
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual IS NOT NULL AND regexp_replace(qual, '[\\s\\(\\)]', '', 'g') = 'true')
    OR (with_check IS NOT NULL AND regexp_replace(with_check, '[\\s\\(\\)]', '', 'g') = 'true')
  )
ORDER BY schemaname, tablename, policyname;

\echo ''
\echo '== Policies public sin USING ni WITH CHECK (revisar manualmente) =='
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND qual IS NULL
  AND with_check IS NULL
ORDER BY schemaname, tablename, policyname;

\echo ''
\echo '== Funciones SECURITY DEFINER sin search_path fijo =='
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p.proconfig, '{}'::text[])) AS cfg
    WHERE cfg LIKE 'search_path=%'
  )
ORDER BY schema_name, function_name;
