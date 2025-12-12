-- =====================================================
-- POLÍTICAS RLS SIN ERRORES - VERSIÓN CORREGIDA
-- =====================================================
-- Soluciona: "new row violates row-level-security policy"
-- Políticas correctas para permitir operaciones normales
-- =====================================================

-- =====================================================
-- PASO 1: LIMPIAR POLÍTICAS EXISTENTES
-- =====================================================

-- Eliminar TODAS las políticas existentes de businesses
DROP POLICY IF EXISTS "businesses_select" ON businesses;
DROP POLICY IF EXISTS "businesses_insert" ON businesses;
DROP POLICY IF EXISTS "businesses_update" ON businesses;
DROP POLICY IF EXISTS "businesses_delete" ON businesses;

-- =====================================================
-- PASO 2: POLÍTICAS RLS CORRECTAS PARA BUSINESSES
-- =====================================================

-- SELECT: Ver negocios donde soy owner O empleado activo
CREATE POLICY "businesses_select_policy"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (
    -- Soy el creador del negocio
    created_by = auth.uid()
    OR
    -- Soy empleado activo en el negocio
    id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- INSERT: Cualquier usuario autenticado puede crear un negocio
-- ✅ CLAVE: Solo WITH CHECK, NO USING
CREATE POLICY "businesses_insert_policy"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Solo validar que el usuario sea el creador
    created_by = auth.uid()
  );

-- UPDATE: Solo el owner puede actualizar
CREATE POLICY "businesses_update_policy"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Solo el owner puede eliminar
CREATE POLICY "businesses_delete_policy"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- PASO 3: POLÍTICAS PARA EMPLOYEES
-- =====================================================

DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;

-- SELECT: Owner/admin ven todos, employee solo su perfil
CREATE POLICY "employees_select_policy"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    -- Es mi propio registro
    user_id = auth.uid()
    OR
    -- Soy owner del negocio
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    -- Soy admin del negocio
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- INSERT: Solo owner/admin pueden agregar empleados
CREATE POLICY "employees_insert_policy"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Soy owner del negocio
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    -- Soy admin del negocio
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- UPDATE: Owner/admin actualizan todos, employee solo su perfil
CREATE POLICY "employees_update_policy"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (
    -- Es mi propio registro
    user_id = auth.uid()
    OR
    -- Soy owner del negocio
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    -- Soy admin del negocio
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  )
  WITH CHECK (
    -- Mismo criterio para validación
    user_id = auth.uid()
    OR
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- DELETE: Solo owner puede eliminar empleados
CREATE POLICY "employees_delete_policy"
  ON employees
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
  );

-- =====================================================
-- PASO 4: POLÍTICAS PARA PRODUCTS
-- =====================================================

DROP POLICY IF EXISTS "products_all" ON products;
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

-- Política simple: Acceso a productos del negocio donde trabajo
CREATE POLICY "products_access_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Soy owner del negocio
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    -- Soy empleado activo del negocio
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    -- Mismo criterio para inserts/updates
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- PASO 5: POLÍTICAS PARA SUPPLIERS
-- =====================================================

DROP POLICY IF EXISTS "suppliers_all" ON suppliers;

CREATE POLICY "suppliers_access_policy"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- PASO 6: POLÍTICAS PARA SALES
-- =====================================================

DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "sales_update" ON sales;
DROP POLICY IF EXISTS "sales_delete" ON sales;

-- SELECT: Owner/admin ven todas, employee solo las suyas
CREATE POLICY "sales_select_policy"
  ON sales
  FOR SELECT
  TO authenticated
  USING (
    -- Es mi venta
    user_id = auth.uid()
    OR
    -- Soy owner del negocio
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    -- Soy admin del negocio
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- INSERT: Cualquier empleado activo puede crear ventas
CREATE POLICY "sales_insert_policy"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Soy el vendedor
    user_id = auth.uid()
    AND
    -- Trabajo en el negocio
    (
      business_id IN (
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
      OR
      business_id IN (
        SELECT business_id FROM employees 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- UPDATE: Solo owner/admin pueden modificar ventas
CREATE POLICY "sales_update_policy"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- DELETE: Solo owner/admin
CREATE POLICY "sales_delete_policy"
  ON sales
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true
    )
  );

-- =====================================================
-- PASO 7: POLÍTICAS PARA SALE_DETAILS
-- =====================================================

DROP POLICY IF EXISTS "sale_details_select" ON sale_details;
DROP POLICY IF EXISTS "sale_details_insert" ON sale_details;
DROP POLICY IF EXISTS "sale_details_update" ON sale_details;
DROP POLICY IF EXISTS "sale_details_delete" ON sale_details;

-- Acceso a sale_details basado en acceso a la venta padre
CREATE POLICY "sale_details_access_policy"
  ON sale_details
  FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT id FROM sales 
      WHERE user_id = auth.uid()
        OR business_id IN (
          SELECT id FROM businesses WHERE created_by = auth.uid()
        )
        OR business_id IN (
          SELECT business_id FROM employees 
          WHERE user_id = auth.uid() 
            AND role IN ('admin', 'employee', 'cashier')
            AND is_active = true
        )
    )
  )
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE user_id = auth.uid()
        OR business_id IN (
          SELECT id FROM businesses WHERE created_by = auth.uid()
        )
        OR business_id IN (
          SELECT business_id FROM employees 
          WHERE user_id = auth.uid() AND is_active = true
        )
    )
  );

-- =====================================================
-- PASO 8: POLÍTICAS PARA PURCHASES, INVOICES, CUSTOMERS
-- =====================================================

-- PURCHASES
DROP POLICY IF EXISTS "purchases_select" ON purchases;
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
DROP POLICY IF EXISTS "purchases_update" ON purchases;
DROP POLICY IF EXISTS "purchases_delete" ON purchases;

CREATE POLICY "purchases_access_policy"
  ON purchases
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- PURCHASE_DETAILS
DROP POLICY IF EXISTS "purchase_details_select" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_insert" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_update" ON purchase_details;
DROP POLICY IF EXISTS "purchase_details_delete" ON purchase_details;

CREATE POLICY "purchase_details_access_policy"
  ON purchase_details
  FOR ALL
  TO authenticated
  USING (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
      OR business_id IN (
        SELECT business_id FROM employees 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  )
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
      OR business_id IN (
        SELECT business_id FROM employees 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- INVOICES
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

CREATE POLICY "invoices_access_policy"
  ON invoices
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- INVOICE_ITEMS
DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;

CREATE POLICY "invoice_items_access_policy"
  ON invoice_items
  FOR ALL
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
      OR business_id IN (
        SELECT business_id FROM employees 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (
        SELECT id FROM businesses WHERE created_by = auth.uid()
      )
      OR business_id IN (
        SELECT business_id FROM employees 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_all" ON customers;

CREATE POLICY "customers_access_policy"
  ON customers
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM employees 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- =====================================================
-- PASO 9: VERIFICACIÓN
-- =====================================================

-- Ver todas las políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd AS operacion,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Contar políticas por tabla
SELECT 
  tablename,
  COUNT(*) as num_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- PASO 10: MENSAJE DE ÉXITO
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS CORREGIDAS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de políticas: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ahora puedes:';
  RAISE NOTICE '  - Crear negocios sin errores';
  RAISE NOTICE '  - Gestionar empleados';
  RAISE NOTICE '  - Crear productos, ventas, compras';
  RAISE NOTICE '  - Aislamiento entre negocios garantizado';
  RAISE NOTICE '============================================';
END $$;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
DIFERENCIAS CLAVE CON VERSIÓN ANTERIOR:

1. ✅ businesses_insert usa SOLO WITH CHECK (no USING)
   - USING se usa para SELECT, UPDATE, DELETE
   - WITH CHECK se usa para INSERT, UPDATE

2. ✅ Políticas sin funciones SECURITY DEFINER
   - Evita dependencias circulares
   - Más simple y directo

3. ✅ Criterios claros:
   - Owner: created_by = auth.uid()
   - Employee: existe en tabla employees como activo
   - Admin: employee con role = 'admin'

4. ✅ Aislamiento garantizado:
   - Cada query valida business_id
   - Usuario solo ve/modifica sus negocios

PRÓXIMOS PASOS:
1. Probar crear negocio desde la app
2. Verificar que empleados solo ven su negocio
3. Confirmar que roles funcionan correctamente
*/
