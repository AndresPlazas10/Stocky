-- ============================================================
-- VERIFICACIÓN POST-FIX: Aislamiento por rol y cross-tenant
-- Ejecutar en Supabase SQL Editor DESPUÉS de aplicar las
-- migraciones 20260817_0100/0200/0300/0400.
-- ============================================================

-- ── 0) Helpers nuevos existen ──
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('can_write_business','can_operate_business')
ORDER BY proname;

-- ── 1) No debe quedar NINGUNA policy FOR ALL en tablas críticas ──
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'ALL'
  AND tablename IN ('products','suppliers','combos','combo_items','invoices',
                    'sales','sale_details','purchases','purchase_details',
                    'orders','order_items','tables','businesses')
ORDER BY tablename;

-- Esperado: 0 filas (todas deben estar separadas por operación).

-- ── 2) INSERT/UPDATE/DELETE administrativos deben ser can_write_business ──
SELECT tablename, policyname, cmd,
       CASE WHEN with_check IS NOT NULL AND with_check::text LIKE '%can_write_business%'
            THEN 'OK: with_check can_write_business'
            WHEN cmd = 'DELETE' AND qual::text LIKE '%can_write_business%'
            THEN 'OK: using can_write_business'
            ELSE 'REVISAR: sin can_write_business'
       END AS estado
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products','suppliers','combos','invoices','purchases')
  AND cmd IN ('INSERT','UPDATE','DELETE')
ORDER BY tablename, cmd;

-- ── 3) DELETE de sales/sale_details solo owner/admin ──
SELECT tablename, policyname, cmd, qual::text AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('sales','sale_details')
  AND cmd = 'DELETE';

-- Esperado: using_clause contiene can_write_business.

-- ── 4) businesses UPDATE solo owner/admin; INSERT con created_by propio ──
SELECT tablename, policyname, cmd, qual::text AS using_clause, with_check::text AS with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'businesses'
ORDER BY cmd;

-- ── 5) create_employee ya NO debe contener 'Flujo transitorio' ──
SELECT CASE WHEN pg_get_functiondef(oid) LIKE '%Flujo transitorio%' THEN 'VULNERABLE: rama transitoria presente'
            WHEN pg_get_functiondef(oid) LIKE '%can_manage_business_employees%' THEN 'OK: validación con can_manage_business_employees'
            ELSE 'REVISAR' END AS estado
FROM pg_proc WHERE proname = 'create_employee';

-- ── 6) check_product_can_delete debe validar can_access_business ──
SELECT CASE WHEN pg_get_functiondef(oid) LIKE '%can_access_business%' THEN 'OK: valida tenant'
            ELSE 'VULNERABLE: sin validación de tenant' END AS estado
FROM pg_proc WHERE proname = 'check_product_can_delete';

-- ── 7) PRUEBA FUNCIONAL DE AISLAMIENTO (impersona al dueño del negocio) ──
SELECT set_config('request.jwt.claims',
  json_build_object(
    'sub', (
      SELECT b.created_by FROM businesses b
      JOIN (SELECT o.business_id FROM orders o
            WHERE o.status = 'open' ORDER BY o.updated_at DESC LIMIT 1) s ON s.business_id = b.id
      LIMIT 1
    ),
    'role', 'authenticated'
  )::text,
  true);

-- 7a) Dueño puede leer productos de SU negocio
SELECT 'owner_select_products' AS test,
       COUNT(*) AS productos_visibles
FROM products
WHERE business_id IN (SELECT id FROM businesses WHERE created_by = current_setting('request.jwt.claims', true)::jsonb->>'sub');

-- 7b) Dueño puede crear un producto de prueba en SU negocio
-- (usar un business_id real del dueño)
WITH owner_business AS (
  SELECT id FROM businesses WHERE created_by = current_setting('request.jwt.claims', true)::jsonb->>'sub' LIMIT 1
)
INSERT INTO products (business_id, code, name, sale_price, is_active)
SELECT id, 'TMP-SEC-TEST-' || floor(random()*1000000)::text, 'Producto Test Seguridad', 1000, true
FROM owner_business;

-- (Si el INSERT falla con "new row violates row-level security" → hay un problema con el owner)

-- 7c) Verificar que la función can_write_business funciona para el owner
SELECT current_setting('request.jwt.claims', true)::jsonb->>'sub' AS owner_id,
       (SELECT public.can_write_business(b.id) FROM businesses b
        WHERE b.created_by = current_setting('request.jwt.claims', true)::jsonb->>'sub' LIMIT 1) AS can_write,
       (SELECT public.can_operate_business(b.id) FROM businesses b
        WHERE b.created_by = current_setting('request.jwt.claims', true)::jsonb->>'sub' LIMIT 1) AS can_operate;

-- Esperado: can_write = true, can_operate = true para el dueño.
