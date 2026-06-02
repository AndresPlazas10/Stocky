# 🔍 DIAGNÓSTICO PROFUNDO: FECHAS EN VENTAS

## Problema
Las fechas `created_at` de las ventas no aparecen en la UI aunque se intenta obtenerlas.

## Verificaciones a realizar

### 1. ¿La columna `created_at` existe y tiene valores?
```sql
-- Ejecutar en Supabase SQL Editor
SELECT 
  id,
  created_at,
  business_id,
  total
FROM sales
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:** Deberías ver NULL o valores datetime en `created_at`

---

### 2. ¿RLS está bloqueando la lectura de `created_at`?
```sql
-- Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sales';
```

**Resultado esperado:** `rowsecurity = true`

---

### 3. ¿Las políticas RLS permiten SELECT?
```sql
-- Listar todas las políticas en sales
SELECT 
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sales';
```

**Resultado esperado:** Deberías ver políticas SELECT con `USING (business_id IN ...)`

---

### 4. ¿El DEFAULT NOW() se está ejecutando?
```sql
-- Comprobar que el DEFAULT está configurado
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'created_at';
```

**Resultado esperado:** `column_default = "now()"`

---

### 5. Test directo: Insertar una venta manualmente
```sql
-- Crear una venta de prueba
INSERT INTO sales (business_id, user_id, seller_name, payment_method, total)
VALUES (
  '12345678-1234-1234-1234-123456789012'::uuid, -- Usa un business_id real
  '87654321-4321-4321-4321-210987654321'::uuid, -- Usa un user_id real
  'Test Seller',
  'cash',
  100.00
)
RETURNING id, created_at, business_id, total;
```

**Resultado esperado:** Deberías ver `created_at` con la hora actual (UTC).

---

## Causa probable

### Opción A: `created_at` está NULL en la BD
- Culpable: Algún script SQL antiguo que creó la tabla sin DEFAULT
- Solución: Actualizar los NULL y confirmar DEFAULT

### Opción B: RLS está bloqueando SELECT de `created_at`
- Culpable: Política RLS mal configurada que filtra columnas
- Solución: Revisar políticas, usar SELECT * sin restricciones

### Opción C: El cliente no incluye `created_at` en el SELECT
- Culpable: Query selectiva `select('field1, field2, ...')` sin `created_at`
- Solución: Cambiar a `select('*')`

### Opción D: Trigger que elimina o NULL-ifica `created_at`
- Culpable: Un trigger BEFOREInsert que modifica el valor
- Solución: Revisar y remover triggers innecesarios

---

## Pasos de Fix (en orden de probabilidad)

### 1️⃣ Verificar que `created_at` tiene valores
```sql
UPDATE sales 
SET created_at = NOW() 
WHERE created_at IS NULL;
```

### 2️⃣ Verificar DEFAULT
```sql
ALTER TABLE sales
ALTER COLUMN created_at SET DEFAULT NOW();
```

### 3️⃣ Verificar RLS no filtra
```sql
-- Ejecutar como superuser
SELECT * FROM sales LIMIT 1; -- Sin RLS activa
```

### 4️⃣ Revisar si hay triggers problemáticos
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sales';
```

---

## Próximos pasos
1. Ejecuta las queries anteriores en Supabase SQL Editor
2. Reporta cuál falla o qué valores ves
3. Te proporcionaré el fix exacto basado en los resultados
