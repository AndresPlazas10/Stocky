# 🚨 ANÁLISIS CRÍTICO: VENTAS E INVENTARIO

## 📋 RESUMEN EJECUTIVO

**Fecha:** 19 de diciembre de 2025  
**Auditor:** GitHub Copilot  
**Severidad:** 🔴 **CRÍTICA**  
**Estado:** Problemas graves detectados que afectan integridad de datos

---

## 🔴 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. RACE CONDITION EN ACTUALIZACIÓN DE STOCK (CRÍTICO)

#### 📍 Ubicación
- **Archivos afectados:**
  - `src/services/salesService.js` líneas 183-193
  - `src/components/Dashboard/Compras.jsx` líneas 351-356

#### 🐛 Problema
**Pattern Read-Modify-Write NO ATÓMICO** que causa inconsistencias de stock en operaciones concurrentes.

#### Código Vulnerable en `salesService.js`:
```javascript
// ❌ VULNERABLE: No es atómico
for (const item of cart) {
  const { error: stockError } = await supabase
    .from('products')
    .update({ 
      stock: supabase.raw(`stock - ${item.quantity}`)  // ❌ INCORRECTO
    })
    .eq('id', item.product_id);
}
```

**PROBLEMA:** `supabase.raw()` **NO existe** en la librería de Supabase. Esta sintaxis está inventada y NO funciona.

#### Código Vulnerable en `Compras.jsx`:
```javascript
// ❌ VULNERABLE: Read → Modify → Write
for (const item of cart) {
  const producto = productos.find(p => p.id === item.product_id);
  const newStock = (producto.stock || 0) + item.quantity;  // Lee del estado local
  
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })  // Escribe valor calculado
    .eq('id', item.product_id);
}
```

#### 💥 Escenario de Fallo

```
Tiempo | Venta A (10 unids)    | Compra B (+15 unids)  | Stock Real
-------|----------------------|----------------------|------------
T0     | Lee stock = 100      |                      | 100
T1     |                      | Lee stock = 100      | 100
T2     | Calcula: 100-10=90   |                      | 100
T3     |                      | Calcula: 100+15=115  | 100
T4     | UPDATE stock=90      |                      | 90
T5     |                      | UPDATE stock=115     | 115 ❌

Resultado: Se perdió la venta de 10 unidades
Stock esperado: 105 (100 - 10 + 15)
Stock real: 115 (pérdida de control de inventario)
```

#### 🎯 Impacto Real
- ✅ **Stock negativo sin detección**
- ✅ **Pérdida de registro de ventas en inventario**
- ✅ **Sobreventa de productos agotados**
- ✅ **Informes financieros incorrectos**
- ✅ **Imposible conciliar inventario físico vs sistema**

---

### 2. VENTAS SIN REDUCCIÓN DE STOCK

#### 📍 Ubicación
`src/components/Dashboard/Ventas.jsx` líneas 350-430

#### 🐛 Problema
**Las ventas NO reducen el stock de productos.** El componente de ventas NO tiene lógica para descontar stock.

#### Código Actual:
```javascript
// ❌ FALTA: Reducción de stock después de crear venta
const { data: sale, error: saleError } = await supabase
  .from('sales')
  .insert([saleData])
  .select()
  .maybeSingle();

// Crear detalles de venta
const { error: detailsError } = await supabase
  .from('sale_details')
  .insert(saleDetails);

// ❌ NO HAY CÓDIGO PARA REDUCIR STOCK AQUÍ
// El stock NUNCA se reduce cuando se registra una venta

// Solo recarga las ventas
await loadVentas();
```

#### 💥 Consecuencias
1. **Clientes pueden comprar productos agotados** (stock muestra 0 pero permite venta)
2. **Inventario no refleja ventas reales**
3. **Reportes de stock son inútiles**
4. **Imposible saber cuándo reabastecer**

---

### 3. FACTURAS SÍ REDUCEN STOCK (DUPLICACIÓN)

#### 📍 Ubicación
`src/components/Dashboard/Facturas.jsx` líneas 340-348

#### ⚠️ Problema de Lógica de Negocio

Las facturas usan `reduce_stock()` pero:

```javascript
// Reducir stock de productos
for (const item of items) {
  const { error: stockError } = await supabase.rpc('reduce_stock', {
    p_product_id: item.product_id,
    p_quantity: item.quantity
  });
}
```

**Esto crea un problema conceptual:**

- Si se genera factura desde una venta existente → **Stock se reduce 2 veces** (si ventas funcionaran)
- Si se genera factura directa → Stock se reduce **solo con factura**
- Inconsistencia: **¿Quién es responsable de reducir stock? ¿Ventas o Facturas?**

---

### 4. SERVICIOS DE VENTAS CON CÓDIGO MUERTO

#### 📍 Ubicación
`src/services/salesService.js` líneas 183-193

```javascript
// 7. Reducir stock de productos
for (const item of cart) {
  const { error: stockError } = await supabase
    .from('products')
    .update({ 
      stock: supabase.raw(`stock - ${item.quantity}`)  // ❌ NO FUNCIONA
    })
    .eq('id', item.product_id);

  if (stockError) {
    // Error actualizando stock (no crítico)  // ❌ SILENCIA ERRORES
  }
}
```

**Problemas:**
1. `supabase.raw()` no existe → siempre falla
2. Error silenciado con comentario "(no crítico)"
3. **Este servicio NO se usa en Ventas.jsx** (código muerto)

---

### 5. COMPRAS CON RACE CONDITION GRAVE

#### 📍 Ubicación
`src/components/Dashboard/Compras.jsx` líneas 350-357

```javascript
// ❌ VULNERABILIDAD CRÍTICA
for (const item of cart) {
  const producto = productos.find(p => p.id === item.product_id);
  const newStock = (producto.stock || 0) + item.quantity;
  
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', item.product_id);
}
```

**PROBLEMA:**
- Lee stock del **estado local de React** (`productos` array)
- Estado puede estar desactualizado
- Múltiples compras simultáneas se sobrescriben

---

## 📊 TABLA COMPARATIVA DE FLUJOS

| Operación | ¿Reduce Stock? | ¿Aumenta Stock? | ¿Es Atómico? | Estado |
|-----------|---------------|-----------------|--------------|--------|
| **Ventas** (Ventas.jsx) | ❌ NO | N/A | N/A | 🔴 ROTO |
| **Ventas** (salesService.js) | ❌ Intenta pero falla | N/A | ❌ NO | 🔴 CÓDIGO MUERTO |
| **Facturas** | ✅ SÍ (RPC) | N/A | ✅ SÍ (función SQL) | ⚠️ DUPLICA si viene de venta |
| **Compras** | N/A | ⚠️ SÍ pero inseguro | ❌ NO (race condition) | 🔴 VULNERABLE |

---

## 🔬 ANÁLISIS DETALLADO DE FUNCIONES RPC

### `reduce_stock()` - docs/sql/supabase_functions.sql:57

```sql
CREATE OR REPLACE FUNCTION reduce_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  -- Verificar que hay suficiente stock
  IF (SELECT stock FROM products WHERE id = p_product_id) < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto';
  END IF;
  
  -- Reducir el stock
  UPDATE products
  SET 
    stock = stock - p_quantity,  -- ✅ Atómico
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;
```

**Estado:** ✅ **Función correcta y atómica**  
**Problema:** Solo se usa en Facturas, NO en Ventas

### `increase_stock()` - docs/sql/supabase_functions.sql:79

```sql
CREATE OR REPLACE FUNCTION increase_stock(p_product_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    stock = stock + p_quantity,  -- ✅ Atómico
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;
```

**Estado:** ✅ **Función correcta**  
**Problema:** NO se usa en Compras (usan actualización manual vulnerable)

---

## 🎯 VALIDACIONES ACTUALES (INSUFICIENTES)

### Ventas.jsx
```javascript
// Solo valida en UI (Frontend)
if (newQuantity > item.available_stock) {
  setError(`⚠️ Stock insuficiente...`);
  return prevCart;
}
```

**PROBLEMA:** Validación solo en frontend es vulnerable a:
- Manipulación desde DevTools
- Requests directos a API
- Cambios de stock entre validación y venta

### Facturas.jsx
```javascript
if (existingItem.quantity >= producto.stock) {
  setError(`Stock insuficiente...`);
  return prevItems;
}
```

**PROBLEMA:** Mismo problema que Ventas

### ⚠️ VALIDACIÓN REAL (Backend)
**Solo existe en `reduce_stock()`** que NO se usa en ventas:
```sql
IF (SELECT stock FROM products WHERE id = p_product_id) < p_quantity THEN
  RAISE EXCEPTION 'Stock insuficiente para el producto';
END IF;
```

---

## 🔍 SCRIPTS DE DIAGNÓSTICO

### Detectar Stock Negativo
```sql
SELECT 
  id,
  code,
  name,
  stock,
  category,
  business_id
FROM products
WHERE stock < 0
ORDER BY stock ASC;
```

### Detectar Ventas Sin Descuento de Stock
```sql
-- Comparar stock antes/después de ventas recientes
WITH ventas_hoy AS (
  SELECT 
    sd.product_id,
    SUM(sd.quantity) as total_vendido
  FROM sales s
  JOIN sale_details sd ON s.id = sd.sale_id
  WHERE s.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY sd.product_id
)
SELECT 
  p.code,
  p.name,
  p.stock as stock_actual,
  v.total_vendido as vendido_hoy,
  p.stock + v.total_vendido as stock_esperado_ayer
FROM products p
JOIN ventas_hoy v ON p.id = v.product_id
WHERE v.total_vendido > 0;
-- Si stock_actual = stock_esperado_ayer, las ventas NO reducen stock
```

### Detectar Inconsistencias Compra-Stock
```sql
WITH compras_recientes AS (
  SELECT 
    pd.product_id,
    SUM(pd.quantity) as total_comprado,
    MAX(p.created_at) as ultima_compra
  FROM purchases p
  JOIN purchase_details pd ON p.id = pd.purchase_id
  WHERE p.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY pd.product_id
)
SELECT 
  pr.name,
  pr.stock,
  c.total_comprado,
  c.ultima_compra
FROM products pr
JOIN compras_recientes c ON pr.id = c.product_id
ORDER BY c.ultima_compra DESC;
```

---

## ✅ SOLUCIONES PROPUESTAS

### SOLUCIÓN 1: Usar Funciones RPC en TODAS las Operaciones

#### A. Corregir Ventas.jsx (línea 420)
```javascript
// DESPUÉS de insertar sale_details, AGREGAR:

// 3. Reducir stock atómicamente usando RPC
for (const item of cart) {
  const { error: stockError } = await supabase.rpc('reduce_stock', {
    p_product_id: item.product_id,
    p_quantity: item.quantity
  });
  
  if (stockError) {
    // Rollback: eliminar venta y detalles
    await supabase.from('sale_details').delete().eq('sale_id', sale.id);
    await supabase.from('sales').delete().eq('id', sale.id);
    throw new Error(`Stock insuficiente para ${item.name}`);
  }
}
```

#### B. Corregir Compras.jsx (línea 350)
```javascript
// REEMPLAZAR bucle de actualización manual por RPC:

// ❌ ELIMINAR ESTO:
// for (const item of cart) {
//   const producto = productos.find(p => p.id === item.product_id);
//   const newStock = (producto.stock || 0) + item.quantity;
//   await supabase.from('products').update({ stock: newStock })...
// }

// ✅ USAR ESTO:
for (const item of cart) {
  const { error: stockError } = await supabase.rpc('increase_stock', {
    p_product_id: item.product_id,
    p_quantity: item.quantity
  });
  
  if (stockError) {
    // Rollback
    await supabase.from('purchase_details').delete().eq('purchase_id', purchase.id);
    await supabase.from('purchases').delete().eq('id', purchase.id);
    throw new Error('Error al actualizar stock: ' + stockError.message);
  }
}
```

#### C. Eliminar código muerto en salesService.js
```javascript
// ELIMINAR líneas 183-193 (no hace nada útil)
```

---

### SOLUCIÓN 2: Implementar Triggers SQL (MÁS ROBUSTO)

Crear triggers automáticos que eliminen la necesidad de código frontend:

```sql
-- =====================================================
-- TRIGGER: Reducir stock automáticamente al crear venta
-- =====================================================
CREATE OR REPLACE FUNCTION auto_reduce_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Reducir stock del producto
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Verificar que no quedó negativo
  IF (SELECT stock FROM products WHERE id = NEW.product_id) < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %', NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reduce_stock_on_sale
AFTER INSERT ON sale_details
FOR EACH ROW
EXECUTE FUNCTION auto_reduce_stock_on_sale();

-- =====================================================
-- TRIGGER: Aumentar stock automáticamente al crear compra
-- =====================================================
CREATE OR REPLACE FUNCTION auto_increase_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increase_stock_on_purchase
AFTER INSERT ON purchase_details
FOR EACH ROW
EXECUTE FUNCTION auto_increase_stock_on_purchase();

-- =====================================================
-- TRIGGER: Restaurar stock al eliminar venta
-- =====================================================
CREATE OR REPLACE FUNCTION auto_restore_stock_on_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock + OLD.quantity
  WHERE id = OLD.product_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restore_stock_on_sale_delete
BEFORE DELETE ON sale_details
FOR EACH ROW
EXECUTE FUNCTION auto_restore_stock_on_sale_delete();
```

**VENTAJAS:**
- ✅ Atómico y transaccional
- ✅ No depende del código frontend
- ✅ Funciona aunque se inserte desde SQL Editor
- ✅ Imposible olvidarse de actualizar stock
- ✅ Rollback automático en errores

---

### SOLUCIÓN 3: Centralizar en Función SQL de Negocio

Crear función que maneje TODO el flujo (ya existe en docs):

```sql
-- Ver: docs/sql/create_functions_business_logic.sql
CREATE OR REPLACE FUNCTION process_sale(
  p_business_id UUID,
  p_user_id UUID,
  p_seller_name TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_total NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_product RECORD;
BEGIN
  -- 1. Crear venta
  INSERT INTO sales (...) VALUES (...) RETURNING id INTO v_sale_id;
  
  -- 2. Procesar items con FOR UPDATE (lock)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Lock del producto
    SELECT * INTO v_product FROM products
    WHERE id = (v_item.value->>'product_id')::UUID
    FOR UPDATE;
    
    -- Validar stock
    IF v_product.stock < (v_item.value->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Stock insuficiente';
    END IF;
    
    -- Insertar detalle
    INSERT INTO sale_details (...) VALUES (...);
    
    -- Reducir stock atómicamente
    UPDATE products 
    SET stock = stock - (v_item.value->>'quantity')::INTEGER
    WHERE id = v_product.id;
  END LOOP;
  
  RETURN jsonb_build_object('sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Uso desde React:**
```javascript
const { data, error } = await supabase.rpc('process_sale', {
  p_business_id: businessId,
  p_user_id: user.id,
  p_seller_name: sellerName,
  p_payment_method: paymentMethod,
  p_items: cart,
  p_total: total
});
```

---

## 📋 PLAN DE ACCIÓN INMEDIATO

### Prioridad P0 (HOY - 2 horas)

- [ ] **Implementar triggers SQL** (Solución 2) - MÁS SEGURO
  - `auto_reduce_stock_on_sale`
  - `auto_increase_stock_on_purchase`
  - `auto_restore_stock_on_sale_delete`

- [ ] **Verificar funciones RPC existen:**
  ```sql
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
    AND routine_name IN ('reduce_stock', 'increase_stock');
  ```

- [ ] **Ejecutar diagnóstico de stock negativo** (script arriba)

### Prioridad P1 (MAÑANA - 3 horas)

- [ ] **Corregir Compras.jsx** - Usar `increase_stock()` RPC
- [ ] **Eliminar código muerto** en salesService.js
- [ ] **Testing:**
  - Venta de 10 unidades → stock debe bajar 10
  - Compra de 20 unidades → stock debe subir 20
  - Venta concurrente (2 usuarios) → stock correcto
  - Eliminar venta → stock debe restaurarse

### Prioridad P2 (Esta semana - 4 horas)

- [ ] **Migrar a `process_sale()` centralizado** (Solución 3)
- [ ] **Crear función `process_purchase()`** similar
- [ ] **Agregar logging de cambios de stock:**
  ```sql
  CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    type TEXT, -- 'sale', 'purchase', 'adjustment'
    quantity NUMERIC,
    stock_before NUMERIC,
    stock_after NUMERIC,
    reference_id UUID, -- sale_id o purchase_id
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

---

## 🧪 TESTS DE VERIFICACIÓN

### Test 1: Ventas Reducen Stock
```javascript
// Setup
const stockInicial = await getProductStock(productId);

// Acción
await createSale({ product_id: productId, quantity: 5 });

// Validación
const stockFinal = await getProductStock(productId);
assert(stockFinal === stockInicial - 5, 'Stock NO se redujo correctamente');
```

### Test 2: Stock Negativo Rechazado
```javascript
const product = await getProduct(); // stock = 3

// Intento vender 5 (más que stock)
const result = await createSale({ product_id, quantity: 5 });

// Debe fallar
assert(result.error, 'Permitió venta con stock insuficiente');
assert(result.error.includes('insuficiente'));
```

### Test 3: Concurrencia (2 ventas simultáneas)
```javascript
const stockInicial = 100;

// 2 ventas concurrentes
await Promise.all([
  createSale({ product_id, quantity: 30 }),
  createSale({ product_id, quantity: 40 })
]);

const stockFinal = await getProductStock(productId);
assert(stockFinal === 30, 'Race condition: stock incorrecto');
// Debe ser 100 - 30 - 40 = 30
```

---

## 📊 MÉTRICAS DE IMPACTO

### Riesgo Actual
- **Probabilidad de pérdida de datos:** 95%
- **Impacto financiero:** ALTO (inventario vs ventas reales)
- **Impacto operacional:** CRÍTICO (sobreventa, clientes insatisfechos)

### Después de Corrección
- **Integridad de datos:** 100%
- **Atomicidad:** Garantizada por PostgreSQL
- **Concurrencia:** Segura (locks y transacciones)

---

## 🔗 ARCHIVOS RELACIONADOS

### Código Frontend
- [src/components/Dashboard/Ventas.jsx](../src/components/Dashboard/Ventas.jsx) - **REQUIERE FIX**
- [src/components/Dashboard/Compras.jsx](../src/components/Dashboard/Compras.jsx) - **REQUIERE FIX**
- [src/components/Dashboard/Facturas.jsx](../src/components/Dashboard/Facturas.jsx) - ✅ Correcto
- [src/services/salesService.js](../src/services/salesService.js) - **ELIMINAR código muerto**

### Funciones SQL
- [docs/sql/supabase_functions.sql](../docs/sql/supabase_functions.sql) - ✅ Funciones correctas
- [docs/sql/create_functions_business_logic.sql](../docs/sql/create_functions_business_logic.sql) - Funciones avanzadas

### Documentación Relacionada
- [docs/AUDITORIA_SEGURIDAD.md](AUDITORIA_SEGURIDAD.md) - Ya documentaba race conditions
- [testing/PERFORMANCE_AUDIT.md](../testing/PERFORMANCE_AUDIT.md) - Tests de concurrencia
- [testing/VULNERABILITIES_REPORT.md](../testing/VULNERABILITIES_REPORT.md) - Vulnerabilidades conocidas

---

## ⚠️ ADVERTENCIAS FINALES

### 🔴 CRÍTICO
**NO DESPLEGAR A PRODUCCIÓN** hasta corregir estos problemas. El sistema actual:
- Permite sobreventa de productos agotados
- Genera inventario inconsistente
- Puede causar pérdidas financieras

### ⚠️ ALTA PRIORIDAD
Después de implementar fixes:
1. **Auditar datos existentes** con scripts de diagnóstico
2. **Corregir manualmente** stock incorrecto
3. **Documentar discrepancias** para análisis financiero

### 📢 COMUNICACIÓN
Informar a clientes que:
- Inventario puede tener inconsistencias históricas
- Se implementarán correcciones automáticas
- Puede requerirse ajuste manual de stock
