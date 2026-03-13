WITH required_tables(tablename) AS (
  VALUES
    ('tables'),
    ('orders'),
    ('order_items'),
    ('sales'),
    ('purchases'),
    ('products'),
    ('employees'),
    ('combos'),
    ('sale_details')
),
publication_rows AS (
  SELECT
    r.tablename,
    EXISTS (
      SELECT 1
      FROM pg_publication_tables p
      WHERE p.pubname = 'supabase_realtime'
        AND p.schemaname = 'public'
        AND p.tablename = r.tablename
    ) AS in_publication
  FROM required_tables r
),
rls_rows AS (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('order_items', 'sale_details')
),
policy_rows AS (
  SELECT
    p.tablename,
    p.policyname,
    p.cmd,
    p.roles,
    p.qual,
    p.with_check
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('order_items', 'sale_details', 'sales', 'purchases', 'employees')
),
replica_rows AS (
  SELECT
    c.relname AS table_name,
    c.relreplident AS replica_identity_code,
    CASE c.relreplident
      WHEN 'f' THEN 'FULL'
      WHEN 'd' THEN 'DEFAULT'
      WHEN 'i' THEN 'INDEX'
      WHEN 'n' THEN 'NOTHING'
      ELSE c.relreplident::text
    END AS replica_identity
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('order_items', 'sale_details')
),
function_row AS (
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    INNER JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'can_access_business'
  ) AS exists
)
SELECT json_build_object(
  'generated_at', now(),
  'publication_exists', EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ),
  'required_tables', (
    SELECT COALESCE(json_agg(row_to_json(publication_rows) ORDER BY publication_rows.tablename), '[]'::json)
    FROM publication_rows
  ),
  'rls', (
    SELECT COALESCE(json_agg(row_to_json(rls_rows) ORDER BY rls_rows.table_name), '[]'::json)
    FROM rls_rows
  ),
  'policies', (
    SELECT COALESCE(json_agg(row_to_json(policy_rows) ORDER BY policy_rows.tablename, policy_rows.policyname), '[]'::json)
    FROM policy_rows
  ),
  'replica_identity', (
    SELECT COALESCE(json_agg(row_to_json(replica_rows) ORDER BY replica_rows.table_name), '[]'::json)
    FROM replica_rows
  ),
  'can_access_business_exists', (
    SELECT exists FROM function_row
  )
) AS contract_snapshot;
