# 🔒 ANÁLISIS COMPLETO: POLÍTICAS RLS - PROBLEMAS Y SOLUCIONES

## 📋 Índice

1. [Problemas Comunes con RLS](#problemas-comunes)
2. [Arquitectura del Proyecto](#arquitectura)
3. [Soluciones Implementadas](#soluciones)
4. [Testing y Verificación](#testing)
5. [Mejores Prácticas](#mejores-practicas)

---

## 🚨 PROBLEMAS COMUNES CON RLS

### 1. Recursión Infinita

**Síntoma:**
```
ERROR: infinite recursion detected in policy for relation "businesses"
```

**Causa:**
```sql
-- ❌ INCORRECTO
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM employees  -- ← Lee employees
      WHERE user_id = auth.uid()
    )
  );

-- employees también tiene política que referencia businesses
CREATE POLICY "employees_select"
  ON employees
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses  -- ← Lee businesses
      WHERE created_by = auth.uid()
    )
  );

-- RESULTADO: businesses → employees → businesses → ∞
```

**Solución:**
```sql
-- ✅ CORRECTO: Usar función SECURITY DEFINER (sin RLS)
CREATE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER  -- ← NO evalúa RLS
SET search_path = public
AS $$
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Ahora las políticas no son recursivas
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  USING (created_by = auth.uid());  -- ← Solo validación directa

CREATE POLICY "products_all"
  ON products
  FOR ALL
  USING (business_id IN (SELECT get_user_business_ids()));  -- ← Usa función
```

---

### 2. Foreign Key a auth.users

**Síntoma:**
```
ERROR: permission denied for schema auth
ERROR: relation "public.users" does not exist
```

**Causa:**
```sql
-- ❌ INCORRECTO
CREATE TABLE purchases (
  user_id UUID REFERENCES auth.users(id)  -- ← No permitido
);

-- o peor aún:
CREATE TABLE purchases (
  user_id UUID REFERENCES users(id)  -- ← Tabla no existe en public
);
```

**Problema:**
- `auth.users` es tabla del sistema Supabase (schema `auth`, no `public`)
- No se pueden crear FK hacia tablas de otros schemas
- La tabla `users` NO existe en `public` schema

**Solución:**
```sql
-- ✅ CORRECTO
CREATE TABLE purchases (
  user_id UUID NOT NULL  -- ← Sin FK, solo UUID
);

COMMENT ON COLUMN purchases.user_id IS 
  'Usuario autenticado (auth.users.id) - Sin FK por ser schema auth';

-- La integridad se valida a nivel de aplicación:
-- 1. supabase.auth.getUser() retorna el user actual
-- 2. Se inserta ese user.id en purchases.user_id
-- 3. La validación de acceso se hace via RLS
```

---

### 3. Políticas Muy Restrictivas

**Síntoma:**
```
ERROR: new row violates row-level security policy for table "businesses"
```

**Causa:**
```sql
-- ❌ INCORRECTO: Política de INSERT solo con USING
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  USING (created_by = auth.uid());  -- ← WRONG!

-- PROBLEMA: USING se evalúa ANTES del INSERT
-- created_by aún no tiene valor, la política falla
```

**Solución:**
```sql
-- ✅ CORRECTO: Política de INSERT con WITH CHECK
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  WITH CHECK (created_by = auth.uid());  -- ← Correcto

-- USING → Para SELECT (leer filas existentes)
-- WITH CHECK → Para INSERT/UPDATE (validar nuevas filas)
```

**Regla de oro:**
```sql
-- SELECT
FOR SELECT
  USING (condición)

-- INSERT  
FOR INSERT
  WITH CHECK (condición)

-- UPDATE
FOR UPDATE
  USING (condición para leer)      -- ¿Puedo ver esta fila?
  WITH CHECK (condición para escribir)  -- ¿Puedo guardar este cambio?

-- DELETE
FOR DELETE
  USING (condición)
```

---

### 4. Subconsultas Lentas

**Síntoma:**
- Queries muy lentas (> 2 segundos)
- Timeout en producción
- Alto uso de CPU

**Causa:**
```sql
-- ❌ LENTO: Subconsulta se ejecuta por CADA fila
CREATE POLICY "products_select"
  ON products
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
      UNION
      SELECT business_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Con 1000 productos → 1000 subconsultas
```

**Solución:**
```sql
-- ✅ RÁPIDO: Función evaluada UNA vez
CREATE POLICY "products_select"
  ON products
  FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

-- Con 1000 productos → 1 subconsulta + lookup en resultados
```

---

### 5. Políticas Contradictorias

**Síntoma:**
```
ERROR: conflicting or redundant options
```

**Causa:**
```sql
-- ❌ INCORRECTO: Múltiples políticas para misma operación
CREATE POLICY "sales_select_owner"
  ON sales
  FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE created_by = auth.uid()
  ));

CREATE POLICY "sales_select_employee"
  ON sales
  FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM employees WHERE user_id = auth.uid()
  ));

-- PROBLEMA: Se evalúan ambas con OR (puede causar confusión)
```

**Solución:**
```sql
-- ✅ CORRECTO: Una sola política combinada
CREATE POLICY "sales_all"
  ON sales
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- Más simple, más mantenible, más rápida
```

---

## 🏗️ ARQUITECTURA DEL PROYECTO

### Modelo de Datos

```
auth.users (Supabase Auth - Sistema)
    ↓
    ├─→ businesses.created_by (Owner del negocio)
    │
    └─→ employees.user_id (Empleado en negocio)
            ↓
            business_id → Todos los datos del negocio
                          (products, sales, purchases, etc.)
```

### Jerarquía de Acceso

```
┌─────────────────────────────────────────────┐
│ OWNER (businesses.created_by = auth.uid())  │
│ - Acceso total a SU negocio                 │
│ - Puede crear/editar/eliminar todo          │
│ - Puede invitar empleados                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ ADMIN (employees.role = 'admin')            │
│ - Acceso total al negocio                   │
│ - No puede eliminar el negocio              │
│ - Puede gestionar empleados                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ EMPLOYEE (employees.role = 'employee')      │
│ - Acceso a ventas, productos, inventario    │
│ - No puede ver reportes financieros         │
│ - No puede gestionar empleados              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ CASHIER (employees.role = 'cashier')        │
│ - Solo puede registrar ventas               │
│ - No puede ver inventario completo          │
│ - No puede hacer compras                    │
└─────────────────────────────────────────────┘
```

### Tablas y Relaciones

```
businesses (1)
  ├─→ employees (N)
  ├─→ products (N)
  ├─→ suppliers (N)
  ├─→ customers (N)
  ├─→ sales (N)
  │    └─→ sale_details (N)
  ├─→ purchases (N)
  │    └─→ purchase_details (N)
  ├─→ invoices (N)
  │    └─→ invoice_items (N)
  └─→ tables (N)
       └─→ orders (N)
            └─→ order_items (N)
```

---

## ✅ SOLUCIONES IMPLEMENTADAS

### 1. Función `get_user_business_ids()`

**Propósito:**
- Centralizar la lógica de "a qué negocios tengo acceso"
- Evitar recursión infinita (SECURITY DEFINER no evalúa RLS)
- Performance (se evalúa una sola vez por query)

**Implementación:**
```sql
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER  -- ← CLAVE: Sin RLS
SET search_path = public
AS $$
  -- Negocios donde soy owner
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Negocios donde soy empleado activo
  SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true;
$$;
```

**Uso en Políticas:**
```sql
CREATE POLICY "products_all"
  ON products
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
```

**Ventajas:**
- ✅ Sin recursión
- ✅ Rápida (STABLE + memoización)
- ✅ Mantenible (lógica en un solo lugar)
- ✅ Testeable

---

### 2. Política Simplificada para businesses

**Problema:**
No podemos incluir subconsulta a `employees` en la política de `businesses` (recursión).

**Solución:**
```sql
-- ✅ Solo validación directa
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
```

**Consecuencia:**
Los empleados NO ven el negocio directamente via `SELECT * FROM businesses`.

**Workaround en Frontend:**
```javascript
// ❌ NO funciona para empleados
const { data } = await supabase
  .from('businesses')
  .select('*')
  .eq('id', businessId);

// ✅ Funciona para todos (JOIN explícito)
const { data } = await supabase
  .from('businesses')
  .select('*, employees!inner(*)')
  .eq('id', businessId)
  .or(`created_by.eq.${user.id},employees.user_id.eq.${user.id}`);

// ✅ Mejor: Usar función helper
const { data } = await supabase.rpc('get_business_details', {
  p_business_id: businessId
});
```

---

### 3. Patrón Estándar para Todas las Tablas

**Estrategia:**
Usar siempre el mismo patrón (menos sorpresas, más mantenible).

**Template:**
```sql
-- Para tablas con business_id directo
CREATE POLICY "[tabla]_all"
  ON [tabla]
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- Para tablas de detalle (sin business_id directo)
CREATE POLICY "[tabla]_all"
  ON [tabla]
  FOR ALL
  TO authenticated
  USING (
    [tabla_padre]_id IN (
      SELECT id FROM [tabla_padre]
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );
```

**Ejemplos:**
```sql
-- Tabla con business_id
CREATE POLICY "products_all"
  ON products
  FOR ALL
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- Tabla de detalle
CREATE POLICY "sale_details_all"
  ON sale_details
  FOR ALL
  USING (
    sale_id IN (
      SELECT id FROM sales
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );
```

---

### 4. Sin Foreign Keys a auth.users

**Decisión de Diseño:**
```sql
-- ✅ CORRECTO
CREATE TABLE sales (
  user_id UUID NOT NULL  -- ← Sin FK
);

COMMENT ON COLUMN sales.user_id IS 
  'Usuario autenticado (auth.users.id)';
```

**Validación en Aplicación:**
```javascript
// Siempre obtener user actual de Supabase Auth
const { data: { user } } = await supabase.auth.getUser();

// Usar user.id en inserts
const { data, error } = await supabase
  .from('sales')
  .insert({
    business_id: businessId,
    user_id: user.id,  // ← Garantizado que existe
    total: 100
  });
```

---

### 5. Triggers para Prevención de Duplicados

**Problema:**
Doble click en "Crear Negocio" → 2 negocios idénticos.

**Solución:**
```sql
CREATE FUNCTION prevent_duplicate_business_creation()
RETURNS TRIGGER
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_recent_count
  FROM businesses
  WHERE created_by = NEW.created_by
    AND created_at > NOW() - INTERVAL '60 seconds';
  
  IF v_recent_count > 0 THEN
    RAISE EXCEPTION 'Ya creaste un negocio recientemente.'
      USING ERRCODE = '23505';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_duplicate_business
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_business_creation();
```

**Aplicado a:**
- businesses (60 segundos)
- employees (30 segundos)

---

## 🧪 TESTING Y VERIFICACIÓN

### Test 1: Verificar RLS Habilitado

```sql
-- Ver tablas con RLS
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Resultado esperado: ✅ en todas las tablas
```

---

### Test 2: Verificar Políticas

```sql
-- Ver todas las políticas
SELECT 
  tablename,
  policyname,
  cmd AS operacion
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar que cada tabla tenga al menos 1 política
```

---

### Test 3: Probar Acceso como Owner

```sql
-- 1. Crear negocio de prueba
INSERT INTO businesses (name, username, email, created_by)
VALUES (
  'Test Business',
  'test-biz',
  'test@test.com',
  auth.uid()
)
RETURNING *;

-- 2. Verificar que puedo verlo
SELECT * FROM businesses WHERE name = 'Test Business';
-- ✅ Debe retornar 1 fila

-- 3. Crear producto
INSERT INTO products (business_id, name, code, price, stock)
VALUES (
  '[business_id del paso 1]',
  'Producto Test',
  'PRD-001',
  100,
  50
)
RETURNING *;

-- 4. Verificar acceso
SELECT * FROM products WHERE name = 'Producto Test';
-- ✅ Debe retornar 1 fila
```

---

### Test 4: Probar Acceso como Empleado

```sql
-- 1. Crear empleado (como owner)
INSERT INTO employees (
  business_id,
  user_id,
  full_name,
  username,
  email,
  role
) VALUES (
  '[business_id]',
  '[otro_user_id]',  -- Usuario diferente
  'Empleado Test',
  'empleado1',
  'empleado@test.com',
  'employee'
);

-- 2. Cambiar a sesión del empleado (otro navegador/incógnito)
-- Login como empleado

-- 3. Verificar acceso a productos
SELECT * FROM products WHERE business_id = '[business_id]';
-- ✅ Debe ver los productos del negocio

-- 4. Verificar NO puede ver otros negocios
SELECT * FROM businesses;
-- ❌ No debe ver negocios de otros owners
```

---

### Test 5: Probar Función get_user_business_ids()

```sql
-- Como owner
SELECT * FROM get_user_business_ids();
-- ✅ Debe retornar el ID de mi negocio

-- Como empleado
SELECT * FROM get_user_business_ids();
-- ✅ Debe retornar el ID del negocio donde trabajo
```

---

## 📚 MEJORES PRÁCTICAS

### 1. Siempre Usar Funciones SECURITY DEFINER

**Por qué:**
- Evitan recursión infinita
- Son más rápidas (se evalúan una vez)
- Centralizan la lógica

**Cómo:**
```sql
CREATE FUNCTION helper_function()
RETURNS ...
LANGUAGE sql
STABLE
SECURITY DEFINER  -- ← CLAVE
SET search_path = public  -- ← Seguridad
AS $$
  -- Query sin RLS
$$;
```

---

### 2. Políticas Simples y Genéricas

**❌ Evitar:**
```sql
-- Múltiples políticas específicas
CREATE POLICY "products_select_owner" ...
CREATE POLICY "products_select_admin" ...
CREATE POLICY "products_insert_admin" ...
CREATE POLICY "products_update_owner" ...
```

**✅ Preferir:**
```sql
-- Una política para todo
CREATE POLICY "products_all"
  ON products
  FOR ALL  -- ← SELECT, INSERT, UPDATE, DELETE
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));
```

---

### 3. Comentar Decisiones de Diseño

```sql
CREATE TABLE purchases (
  user_id UUID NOT NULL
);

COMMENT ON COLUMN purchases.user_id IS 
  'Usuario autenticado (auth.users.id) - Sin FK porque auth.users está en schema auth, no public';
```

---

### 4. Testing Continuo

**Después de cada cambio:**
```sql
-- 1. Verificar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 2. Contar políticas
SELECT tablename, COUNT(*) FROM pg_policies 
WHERE schemaname = 'public' 
GROUP BY tablename;

-- 3. Probar INSERT como usuario real
```

---

### 5. Índices para Performance

```sql
-- ✅ Siempre indexar columnas usadas en políticas
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_business_user ON employees(business_id, user_id);

-- ✅ Índices para JOINs frecuentes
CREATE INDEX idx_sales_business_id ON sales(business_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
```

---

### 6. Monitorear Queries Lentas

```sql
-- Ver queries más lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Si encuentras queries lentas con RLS → optimizar política
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Antes de Deploy

- [ ] Ejecutar script `SETUP_COMPLETO_SUPABASE.sql`
- [ ] Verificar que RLS está habilitado en todas las tablas
- [ ] Verificar que todas las tablas tienen al menos 1 política
- [ ] Probar acceso como owner
- [ ] Probar acceso como empleado
- [ ] Probar funciones helper (get_user_business_ids, etc.)
- [ ] Verificar índices creados
- [ ] Ejecutar queries de verificación

### Después de Deploy

- [ ] Crear negocio de prueba en producción
- [ ] Invitar empleado de prueba
- [ ] Probar flujo completo (registro, venta, compra)
- [ ] Monitorear logs de errores (24h)
- [ ] Verificar performance (tiempo de respuesta < 200ms)

---

## 📞 TROUBLESHOOTING

### Error: "new row violates row-level security"

**Causa:** Política de INSERT solo con USING (no WITH CHECK)

**Fix:**
```sql
-- ❌ Incorrecto
CREATE POLICY "tabla_insert"
  FOR INSERT
  USING (...);

-- ✅ Correcto
CREATE POLICY "tabla_insert"
  FOR INSERT
  WITH CHECK (...);
```

---

### Error: "infinite recursion detected"

**Causa:** Política referencia tabla que referencia de vuelta

**Fix:** Usar función SECURITY DEFINER

```sql
CREATE FUNCTION get_user_business_ids()
SECURITY DEFINER  -- ← Sin RLS
...
```

---

### Error: Query muy lenta (> 2s)

**Causa:** Subconsulta en política se evalúa por cada fila

**Fix:** Usar función STABLE

```sql
CREATE FUNCTION helper()
LANGUAGE sql
STABLE  -- ← Cachea resultado
...
```

---

### Error: "permission denied for schema auth"

**Causa:** Intentando crear FK a auth.users

**Fix:** Eliminar FK, solo usar UUID

```sql
-- ❌ Incorrecto
user_id UUID REFERENCES auth.users(id)

-- ✅ Correcto
user_id UUID NOT NULL
```

---

## 📖 REFERENCIAS

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Script Completo](./sql/SETUP_COMPLETO_SUPABASE.sql)
- [Idempotency Layer](./sql/IDEMPOTENCY_DATABASE_LAYER.sql)

---

## ✅ RESUMEN

**Claves del Éxito:**

1. ✅ Usar funciones SECURITY DEFINER para evitar recursión
2. ✅ No crear FK a auth.users
3. ✅ Políticas simples con patrón estándar
4. ✅ Testing continuo después de cada cambio
5. ✅ Índices en columnas usadas por políticas
6. ✅ Comentar decisiones de diseño
7. ✅ Monitorear performance en producción

**Evitar:**

1. ❌ Subconsultas recursivas (businesses ↔ employees)
2. ❌ FK a schema auth
3. ❌ Múltiples políticas contradictorias
4. ❌ USING en políticas de INSERT
5. ❌ Olvidar WITH CHECK en políticas de INSERT/UPDATE

---

**Última actualización:** Diciembre 2025  
**Versión:** 2.0
