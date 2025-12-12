-- =====================================================
-- DESACTIVAR COMPLETAMENTE ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Este script desactiva RLS en TODAS las tablas del esquema público
-- y elimina TODAS las políticas activas
-- 
-- ⚠️  ADVERTENCIA: Esto permite acceso sin restricciones a todas las tablas
-- Solo ejecutar si estás seguro de lo que haces
-- =====================================================

-- =====================================================
-- BLOQUE 1: EXPLICACIÓN
-- =====================================================
/*
OBJETIVO:
  Desactivar completamente el Row Level Security (RLS) en todas las tablas
  del esquema público de tu base de datos Supabase.

TABLAS IDENTIFICADAS (15 tablas principales):
  1. businesses          - Negocios/empresas
  2. employees           - Empleados
  3. products            - Productos
  4. sales               - Ventas
  5. sale_details        - Detalles de ventas
  6. purchases           - Compras
  7. purchase_details    - Detalles de compras
  8. suppliers           - Proveedores
  9. invoices            - Facturas
  10. invoice_items      - Items de facturas
  11. customers          - Clientes
  12. tables             - Mesas (restaurante)
  13. orders             - Órdenes/pedidos
  14. order_items        - Items de órdenes
  15. users              - Usuarios (si existe)

PROTECCIONES:
  ✅ NO modifica esquema auth (autenticación de Supabase)
  ✅ NO modifica esquema storage (almacenamiento de archivos)
  ✅ NO modifica esquema pg_catalog (sistema PostgreSQL)
  ✅ NO elimina datos, columnas ni relaciones
  ✅ Solo desactiva políticas y RLS

ACCIONES QUE REALIZA:
  1. Elimina TODAS las políticas activas (DROP POLICY)
  2. Desactiva RLS en cada tabla (DISABLE ROW LEVEL SECURITY)
  3. Desactiva FORCE RLS si fue activado (DISABLE FORCE ROW LEVEL SECURITY)
  4. Verifica el estado final

RIESGO:
  ⚠️  SIN RLS, cualquier usuario autenticado puede:
      - Ver todos los datos de todas las tablas
      - Modificar cualquier registro
      - Eliminar cualquier dato
      
  Esto es útil para:
  - Desarrollo local
  - Testing
  - Migración de datos
  - Debugging de problemas de RLS
  
  NO recomendado para:
  - Producción con múltiples negocios/tenants
  - Aplicaciones con datos sensibles
*/

-- =====================================================
-- BLOQUE 2: SCRIPT SQL COMPLETO
-- =====================================================

BEGIN;

-- =====================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS ACTIVAS
-- =====================================================

-- Políticas de BUSINESSES
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;
DROP POLICY IF EXISTS "businesses_all" ON businesses;
DROP POLICY IF EXISTS "Enable read access for business members" ON businesses;

-- Políticas de EMPLOYEES
DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;
DROP POLICY IF EXISTS "employees_all" ON employees;
DROP POLICY IF EXISTS "Enable read access for business members" ON employees;

-- Políticas de PRODUCTS
DROP POLICY IF EXISTS "products_all" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
DROP POLICY IF EXISTS "Enable read access for business members" ON products;

-- Políticas de SALES
DROP POLICY IF EXISTS "sales_all" ON sales;
DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_delete" ON sales;
DROP POLICY IF EXISTS "Enable read access for business members" ON sales;

-- Políticas de SALE_DETAILS
DROP POLICY IF EXISTS "sale_details_all" ON sale_details;
DROP POLICY IF EXISTS "sale_details_select" ON sale_details;
DROP POLICY IF EXISTS "sale_details_insert" ON sale_details;
DROP POLICY IF EXISTS "sale_details_update" ON sale_details;
DROP POLICY IF EXISTS "sale_details_delete" ON sale_details;
DROP POLICY IF EXISTS "Enable all for business members via sales" ON sale_details;

-- Políticas de PURCHASES
DROP POLICY IF EXISTS "purchases_all" ON purchases;
DROP POLICY IF EXISTS "purchases_select" ON purchases;
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
DROP POLICY IF EXISTS "purchases_update" ON purchases;
DROP POLICY IF EXISTS "purchases_delete" ON purchases;

-- Políticas de PURCHASE_DETAILS
DROP POLICY IF EXISTS "purchase_details_all" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_select" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_insert" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_update" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_delete" ON purchase_details;

-- Políticas de SUPPLIERS
DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

-- Políticas de INVOICES
DROP POLICY IF EXISTS "invoices_all" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

-- Políticas de INVOICE_ITEMS
DROP POLICY IF EXISTS "invoice_items_all" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;

-- Políticas de CUSTOMERS
DROP POLICY IF EXISTS "customers_all" ON customers;
DROP POLICY IF EXISTS "customers_business_isolation" ON customers;
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;

-- Políticas de TABLES (mesas)
DROP POLICY IF EXISTS "tables_all" ON tables;
DROP POLICY IF EXISTS "tables_select" ON tables;
DROP POLICY IF EXISTS "tables_insert" ON tables;
DROP POLICY IF EXISTS "tables_update" ON tables;
DROP POLICY IF EXISTS "tables_delete" ON tables;

-- Políticas de ORDERS
DROP POLICY IF EXISTS "orders_all" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;

-- Políticas de ORDER_ITEMS
DROP POLICY IF EXISTS "order_items_all" ON order_items;
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_update" ON order_items;
DROP POLICY IF EXISTS "order_items_delete" ON order_items;
DROP POLICY IF EXISTS "Enable all for business members via orders" ON order_items;

-- Políticas de USERS (si existe)
DROP POLICY IF EXISTS "users_all" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- =====================================================
-- PASO 2: DESACTIVAR RLS EN TODAS LAS TABLAS
-- =====================================================
-- Nota: FORCE ROW LEVEL SECURITY no es sintaxis válida en PostgreSQL
-- Solo usamos: ALTER TABLE ... DISABLE ROW LEVEL SECURITY

-- Tablas principales (CORE)
ALTER TABLE IF EXISTS businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;

-- Tablas de ventas
ALTER TABLE IF EXISTS sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_details DISABLE ROW LEVEL SECURITY;

-- Tablas de compras
ALTER TABLE IF EXISTS purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_details DISABLE ROW LEVEL SECURITY;

-- Tablas de proveedores y clientes
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;

-- Tablas de facturación
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;

-- Tablas de restaurante (mesas/órdenes)
ALTER TABLE IF EXISTS tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items DISABLE ROW LEVEL SECURITY;

-- Tabla de usuarios (si existe)
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: VERIFICAR ESTADO FINAL
-- =====================================================

-- Mostrar tablas con RLS desactivado
SELECT 
  schemaname,
  tablename AS tabla,
  CASE 
    WHEN rowsecurity THEN '❌ AÚN HABILITADO'
    ELSE '✅ DESHABILITADO'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar políticas restantes (debería estar vacío)
SELECT 
  schemaname,
  tablename AS tabla,
  policyname AS politica_restante
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

COMMIT;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
/*
Después de ejecutar este script, deberías ver:

QUERY 1 (Estado RLS):
  Todas las tablas deben mostrar: ✅ DESHABILITADO

QUERY 2 (Políticas restantes):
  Debería estar VACÍO (0 filas)
  Si hay políticas restantes, significa que tienen nombres diferentes
  a los que anticipamos. En ese caso, ejecuta este query para verlas:

  SELECT 
    schemaname,
    tablename,
    policyname,
    'DROP POLICY "' || policyname || '" ON ' || tablename || ';' AS comando
  FROM pg_policies
  WHERE schemaname = 'public';

  Y ejecuta los comandos DROP POLICY manualmente.
*/

-- =====================================================
-- BLOQUE 3: CÓMO REACTIVAR RLS CORRECTAMENTE
-- =====================================================
/*
PARA REACTIVAR RLS DESPUÉS (cuando lo necesites):

1. USAR EL SCRIPT EXISTENTE:
   Ya tienes scripts preparados en tu proyecto:
   - docs/sql/rls_sin_dependencias_circulares.sql (RECOMENDADO)
   - docs/sql/fix_rls_definitivo.sql
   
   Estos scripts contienen políticas optimizadas sin dependencias circulares.

2. PASOS PARA REACTIVAR:
   
   a) Ejecuta el script completo de RLS:
      ```sql
      -- Archivo: rls_sin_dependencias_circulares.sql
      ```
   
   b) Verifica que las políticas se crearon:
      ```sql
      SELECT schemaname, tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public';
      ```
   
   c) Prueba el acceso con un usuario:
      - Login como usuario normal
      - Verifica que solo ve datos de su business_id
      - Verifica que NO puede ver datos de otros negocios

3. POLÍTICA RECOMENDADA BÁSICA:
   
   Si quieres RLS simple para todas las tablas:
   
   ```sql
   -- Para cada tabla con business_id:
   ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "business_isolation"
   ON nombre_tabla
   FOR ALL
   USING (
     business_id IN (
       SELECT business_id 
       FROM employees 
       WHERE user_id = auth.uid()
     )
   );
   ```

4. VERIFICACIÓN POST-REACTIVACIÓN:
   
   ```sql
   -- Ver políticas activas
   SELECT tablename, policyname, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename;
   
   -- Ver tablas con RLS habilitado
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = true;
   ```

5. TESTING IMPORTANTE:
   - Crear usuario de prueba
   - Asignarlo a un business_id
   - Verificar que solo accede a datos de su negocio
   - Verificar que NO accede a datos de otros negocios
   - Probar INSERT, UPDATE, DELETE

6. MONITOREO:
   Si tienes problemas después de reactivar:
   
   ```sql
   -- Ver qué usuarios tienen acceso
   SELECT 
     e.user_id,
     e.email,
     e.business_id,
     b.name as business_name
   FROM employees e
   JOIN businesses b ON e.business_id = b.id
   WHERE e.is_active = true;
   ```

RECORDATORIO:
  ⚠️  RLS es CRÍTICO para aplicaciones multi-tenant
  ⚠️  Sin RLS, un usuario puede ver/modificar datos de TODOS los negocios
  ⚠️  Siempre testea las políticas antes de ir a producción
*/

-- =====================================================
-- INFORMACIÓN ADICIONAL
-- =====================================================
/*
TABLAS NO INCLUIDAS (no afectadas):
  - auth.users (autenticación de Supabase)
  - auth.* (todo el esquema de autenticación)
  - storage.* (almacenamiento de archivos)
  - pg_catalog.* (sistema PostgreSQL)

COMANDOS ÚTILES DESPUÉS:

1. Ver todas las tablas del esquema público:
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';

2. Ver políticas activas:
   SELECT * FROM pg_policies WHERE schemaname = 'public';

3. Ver triggers activos:
   SELECT * FROM pg_trigger WHERE tgrelid IN (
     SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
   );

4. Ver funciones custom:
   SELECT proname FROM pg_proc 
   WHERE pronamespace = 'public'::regnamespace;
*/

-- =====================================================
-- NOTAS FINALES
-- =====================================================
/*
✅ Este script es SEGURO:
   - No elimina datos
   - No elimina tablas
   - No modifica estructura
   - Solo desactiva políticas de seguridad

⚠️  IMPORTANTE:
   - Guarda una copia de tus políticas antes de eliminarlas
   - Puedes obtenerlas con este query:
   
   SELECT 
     schemaname,
     tablename,
     policyname,
     pg_get_expr(qual, 'public.' || tablename::text) as using_expression,
     pg_get_expr(with_check, 'public.' || tablename::text) as check_expression
   FROM pg_policies
   WHERE schemaname = 'public';

🔄 REVERSIBILIDAD:
   - Este cambio es 100% reversible
   - Puedes reactivar RLS en cualquier momento
   - Las tablas y datos permanecen intactos

📝 DOCUMENTACIÓN:
   - Este script queda guardado en: docs/sql/disable_all_rls.sql
   - Puedes ejecutarlo cuando necesites desactivar RLS
   - Para reactivar, usa: rls_sin_dependencias_circulares.sql

¿DUDAS?
   - Revisa la documentación de Supabase sobre RLS
   - Consulta: https://supabase.com/docs/guides/auth/row-level-security
*/
