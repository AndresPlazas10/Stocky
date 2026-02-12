# 🔧 Troubleshooting: Si algo no funciona

## ❌ Problema: "La venta no se registra / Sigue lenta"

### Causa 1: Función RPC no existe
```
Error: "function create_sale_complete does not exist"
```

**Solución:**
1. Ve a Supabase SQL Editor
2. Ejecuta esta query:
```sql
SELECT proname FROM pg_proc WHERE proname = 'create_sale_complete';
```
3. Si no aparece nada, la función no existe
4. Vuelve a ejecutar el PASO 2 (crear función)

---

### Causa 2: Función existe pero no tiene permisos
```
Error: "permission denied for function create_sale_complete"
```

**Solución:**
Ejecuta estos 3 comandos en el SQL Editor:
```sql
ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  OWNER TO postgres;

ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  TO authenticated;
```

---

### Causa 3: Cliente no está usando la función optimizada
```
Latencia sigue siendo ~1000ms
```

**Solución:**
1. Abre `src/components/Dashboard/Ventas.jsx`
2. Verifica que tiene este import (línea ~5):
```javascript
import { createSaleOptimized, recordSaleCreationTime } from '../../services/salesServiceOptimized';
```

3. Verifica que en la función de crear venta (~línea 330) está usando:
```javascript
const result = await createSaleOptimized({
  businessId,
  cart,
  paymentMethod,
  total: saleTotal
});
```

Si no lo tiene, ejecuta `git pull` o copia-pega manualmente los cambios.

---

## ❌ Problema: "Las fechas no aparecen"

### Causa: created_at es NULL

**Solución:**
1. Abre SQL Editor
2. Ejecuta:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(created_at) as with_date,
  COUNT(*) - COUNT(created_at) as null_count
FROM public.sales;
```

3. Si `null_count` es > 0, ejecuta:
```sql
UPDATE public.sales 
SET created_at = NOW() 
WHERE created_at IS NULL;
```

4. Verifica:
```sql
SELECT id, created_at FROM public.sales 
ORDER BY created_at DESC LIMIT 5;
```

---

## ❌ Problema: "Error: Stock insuficiente para producto"

### Posible causa: El stock se actualizó mal

**Solución:**
1. Verifica el stock en la BD:
```sql
SELECT id, name, current_stock FROM public.products 
WHERE id = '<product-id>';
```

2. Si el stock es incorrecto, actualízalo:
```sql
UPDATE public.products 
SET current_stock = <valor-correcto>
WHERE id = '<product-id>';
```

3. Intenta crear la venta de nuevo

---

## ❌ Problema: "RPC Error: Producto no encontrado o no activo"

### Causa: El producto no existe o está desactivado

**Solución:**
1. Verifica que el producto existe:
```sql
SELECT id, name, is_active FROM public.products 
WHERE id = '<product-id>';
```

2. Si `is_active = false`, actívalo:
```sql
UPDATE public.products 
SET is_active = true
WHERE id = '<product-id>';
```

3. Si no existe, crea el producto desde la app

---

## ❌ Problema: "Timeout después de 30 segundos"

### Causa: La transacción es muy grande o hay un lock

**Solución:**
1. En Supabase, ve a **Database** → **Locks**
2. Si hay locks abiertos, espera o reinicia
3. Intenta con un carrito más pequeño (1-2 productos)
4. Si persiste, contacta a Supabase support

---

## ✅ Debugging: Ver qué está pasando

### Ver logs de la función en tiempo real

En la consola del navegador (F12), crea una venta y ve:
```javascript
// Deberías ver algo como:
// 📦 Creando venta con RPC (inicio): { itemsCount: 2, total: 500, sellerName: 'Juan' }
// ✅ Venta creada en 125ms { sale_id: 'xxx', total_amount: 500, items_count: 2, status: 'success' }
```

Si NO ves estos logs, significa que **no está usando createSaleOptimized**.

### Ver métricas de latencia

En la consola:
```javascript
import { getSaleCreationMetrics } from './src/services/salesServiceOptimized.js';
console.log(getSaleCreationMetrics());
```

Output esperado:
```
{ avg: 125, min: 95, max: 180, count: 8 }
```

Si sale `null`, significa que no hay métricas registradas (no usó createSaleOptimized).

---

## 🆘 Si nada funciona

1. **Verifica que la función existe:**
```sql
SELECT pg_get_functiondef('public.create_sale_complete(uuid,uuid,text,text,jsonb)');
```

2. **Prueba la función directamente desde SQL:**
```sql
SELECT * FROM create_sale_complete(
  '12345678-1234-1234-1234-123456789012'::uuid,  -- business_id
  '87654321-4321-4321-4321-210987654321'::uuid,  -- user_id
  'Test Vendedor',
  'cash',
  '[{"product_id":"prod-uuid","quantity":2,"unit_price":100}]'::jsonb
);
```

3. Si falla aquí, el problema está en la BD, no en el cliente.

4. Si funciona aquí, el problema está en cómo se invoca desde React → verifica imports y llamadas.

---

## 📞 Contacto / Ayuda

- **Errores de PostgreSQL:** Ve a [docs/sql/FIX_SALES_CREATED_AT.sql](docs/sql/FIX_SALES_CREATED_AT.sql)
- **Errores de React:** Mira [src/services/salesServiceOptimized.js](src/services/salesServiceOptimized.js)
- **Documentación:** [RESUMEN_OPTIMIZACIONES_FINALES.md](RESUMEN_OPTIMIZACIONES_FINALES.md)
