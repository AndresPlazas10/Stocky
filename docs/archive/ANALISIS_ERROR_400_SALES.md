# 🔬 ANÁLISIS PROFUNDO: ERROR 400 POST /sales

## 📊 RESUMEN EJECUTIVO

**Error**: `POST /sales → 400 Bad Request`  
**Contexto**: Al cerrar venta en Mesa  
**Usuario**: `admin_1@stockly-app.com` (autenticado ✅)  
**Business ID**: `3f2b775e-a4dd-432a-9913-b73d50238975` (encontrado ✅)

---

## 🔍 HIPÓTESIS PRINCIPALES

### 1️⃣ Problema: Campo `customer_id` en INSERT
**Evidencia**:
```javascript
// Mesas.jsx línea 712
const { data: sale, error: saleError} = await supabase
  .from('sales')
  .insert([{
    business_id: businessId,
    user_id: user.id,  // ✅ Ahora usa user.id actual
    customer_id: selectedCustomer || null,  // ⚠️ POSIBLE PROBLEMA
    total: orderData.total,
    payment_method: paymentMethod,
    seller_name: sellerName
  }])
```

**Problema detectado**: La columna `customer_id` **NO EXISTE** en la tabla `sales`.

### 2️⃣ Problema: Políticas RLS
**Estado actual**: RLS DESHABILITADO (según conversación anterior)
**Verificar**: Si RLS está habilitado, podría causar 400

### 3️⃣ Problema: Constraint violations
**Posibles causas**:
- Foreign key a tabla `customers` (eliminada)
- NOT NULL en campos enviados como null
- Tipo de dato incorrecto

---

## 📋 CÓDIGO ACTUAL QUE HACE EL POST

### Ventas.jsx (línea 386-392)
```javascript
const saleData = {
  business_id: businessId,      // ✅ UUID válido
  user_id: user.id,             // ✅ UUID del usuario actual
  seller_name: employee?.full_name || 'Vendedor',  // ✅ String
  payment_method: paymentMethod,  // ✅ String ('cash', 'card', etc.)
  total: total                   // ✅ Número
};

const { data: sale, error: saleError } = await supabase
  .from('sales')
  .insert([saleData])  // ✅ Array de objetos
  .select()
  .maybeSingle();
```

**Análisis**: Este código parece correcto. ✅

### Mesas.jsx (línea 706-718)
```javascript
const { data: sale, error: saleError} = await supabase
  .from('sales')
  .insert([{
    business_id: businessId,
    user_id: user.id,  // ✅ Corregido - ahora usa user.id
    customer_id: selectedCustomer || null,  // ❌ PROBLEMA
    total: orderData.total,
    payment_method: paymentMethod,
    seller_name: sellerName
  }])
  .select()
  .maybeSingle();
```

**Análisis**: Envía `customer_id` que **NO EXISTE** en tabla. ❌

---

## 🎯 CAUSA RAÍZ IDENTIFICADA

El error 400 se produce porque:

1. **Campo inexistente**: `customer_id` no existe en la tabla `sales`
2. **Tabla eliminada**: La tabla `customers` fue eliminada por el usuario
3. **Foreign key rota**: Si existe FK de `sales.customer_id → customers.id`, falla

---

## ✅ SOLUCIÓN INMEDIATA

### Paso 1: Eliminar `customer_id` del INSERT en Mesas.jsx

```javascript
// ❌ ANTES
const { data: sale, error: saleError} = await supabase
  .from('sales')
  .insert([{
    business_id: businessId,
    user_id: user.id,
    customer_id: selectedCustomer || null,  // ← ELIMINAR ESTO
    total: orderData.total,
    payment_method: paymentMethod,
    seller_name: sellerName
  }])

// ✅ DESPUÉS
const { data: sale, error: saleError} = await supabase
  .from('sales')
  .insert([{
    business_id: businessId,
    user_id: user.id,
    // customer_id eliminado - tabla customers no existe
    total: orderData.total,
    payment_method: paymentMethod,
    seller_name: sellerName
  }])
```

### Paso 2: Verificar estructura de tabla `sales` en Supabase

Ejecutar en SQL Editor:
```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
ORDER BY ordinal_position;
```

### Paso 3: Verificar foreign keys

```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sales';
```

### Paso 4: Si existe FK a `customers`, eliminarla

```sql
-- Si aparece constraint como 'sales_customer_id_fkey'
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;

-- Eliminar columna customer_id si existe
ALTER TABLE sales DROP COLUMN IF EXISTS customer_id;
```

---

## 📊 ESTRUCTURA ESPERADA DE TABLA `sales`

```sql
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_name TEXT,  -- Nombre del vendedor (agregado recientemente)
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO debe tener customer_id
```

---

## 🧪 TESTING

### Test 1: Verificar INSERT directo
```sql
INSERT INTO sales (business_id, user_id, seller_name, total, payment_method)
VALUES (
  '3f2b775e-a4dd-432a-9913-b73d50238975',
  '3382bbb1-0477-4950-bec0-6fccb74c111c',
  'Test Vendedor',
  1000.00,
  'cash'
) RETURNING *;
```

Si falla → verificar constraints  
Si funciona → problema está en RLS o código React

### Test 2: Verificar con Supabase REST API
```bash
curl -X POST 'https://wngjyrkqxblnhxliakqj.supabase.co/rest/v1/sales' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "3f2b775e-a4dd-432a-9913-b73d50238975",
    "user_id": "3382bbb1-0477-4950-bec0-6fccb74c111c",
    "seller_name": "Test",
    "total": 1000,
    "payment_method": "cash"
  }'
```

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Eliminar `customer_id` de Mesas.jsx
2. ⏳ Verificar estructura de tabla sales
3. ⏳ Eliminar constraint FK a customers si existe
4. ⏳ Eliminar columna customer_id si existe
5. ⏳ Probar venta desde Mesa
6. ⏳ Verificar logs en Supabase Dashboard

---

## 📝 NOTAS ADICIONALES

- RLS está deshabilitado en businesses/employees
- Tabla customers fue eliminada manualmente
- seller_name fue agregado recientemente
- user_id puede ser null (ventas antiguas)
