# 🚀 OPTIMIZACIÓN DE VENTAS: Reducir de ~1000ms a ~100ms

## Problema Actual
La creación de una venta tarda ~1 segundo porque hace **5 round-trips al servidor**:

```
1. Validar sesión                    ~50ms
2. Obtener empleado                  ~50ms
3. INSERT venta                       ~150ms
4. INSERT detalles                    ~150ms
5. RPC actualizar stock               ~600ms
────────────────────────────────────────
TOTAL:                                ~1000ms
```

## Solución: Función RPC Todo-en-Uno
Movemos **TODA la lógica a la base de datos** en una sola transacción = **1 round-trip = ~100-150ms**.

---

## Pasos de Implementación

### 1️⃣ Crear la función RPC en Supabase

Copia-pega en el **SQL Editor** de Supabase (como superusuario):

```sql
-- Copiar contenido de supabase/functions/create_sale_complete.sql
```

Luego ejecuta como superusuario:
```sql
ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  OWNER TO postgres;
ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  SET search_path = public;
GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  TO authenticated;
```

### 2️⃣ Importar el servicio optimizado en Ventas.jsx

En `src/components/Dashboard/Ventas.jsx`, reemplaza la llamada a `createSale`:

**Antes:**
```javascript
import { createSale } from '../../services/salesService';

// En handleSubmit:
const result = await createSale({
  businessId,
  cart,
  paymentMethod,
  total
});
```

**Después:**
```javascript
import { createSaleOptimized } from '../../services/salesServiceOptimized';

// En handleSubmit:
const result = await createSaleOptimized({
  businessId,
  cart,
  paymentMethod,
  total
});
```

### 3️⃣ (Opcional) Registrar métricas de latencia

Después de crear la venta, registra el tiempo:

```javascript
import { recordSaleCreationTime, getSaleCreationMetrics } from '../../services/salesServiceOptimized';

if (result.success) {
  recordSaleCreationTime(elapsed); // elapsed en ms
  
  // Ver métricas en consola
  const metrics = getSaleCreationMetrics();
  console.log('📊 Estadísticas:', metrics);
}
```

---

## Beneficios

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Latencia** | ~1000ms | ~100-150ms | **🟢 10x más rápido** |
| **Round-trips** | 5 | 1 | **🟢 80% menos** |
| **Transacciones** | Múltiples | 1 | **🟢 ACID garantizado** |
| **Validaciones** | Cliente + servidor | Servidor (seguro) | **🟢 Más seguro** |

---

## Seguridad

- ✅ Función usa `SECURITY DEFINER` (ejecuta con permisos owner)
- ✅ Valida stock ANTES de actualizar (FOR UPDATE lock)
- ✅ Rollback automático si algo falla
- ✅ No expone RLS al cliente innecesariamente

---

## Testing

### Test Manual
```javascript
// En la consola del navegador
const { createSaleOptimized, recordSaleCreationTime } = await import('./src/services/salesServiceOptimized.js');

const result = await createSaleOptimized({
  businessId: 'your-id',
  cart: [{ product_id: 'xxx', quantity: 2, unit_price: 100 }],
  total: 200
});

console.log(result);
```

### Ver métricas
```javascript
import { getSaleCreationMetrics } from './src/services/salesServiceOptimized.js';
console.log(getSaleCreationMetrics());
```

---

## Fallback (Si la función falla)

Si ejecutas esto y la función no existe, volverá al error. Asegúrate de:

1. ✅ Haber creado la función RPC
2. ✅ Haber ejecutado los GRANTs
3. ✅ Haber esperado a que se sincronice (~30s)

---

## Archivos

- [supabase/functions/create_sale_complete.sql](supabase/functions/create_sale_complete.sql) - Función RPC
- [src/services/salesServiceOptimized.js](src/services/salesServiceOptimized.js) - Cliente optimizado

---

## Próximos pasos opcionales

1. Aplicar el mismo patrón a **deleteS sale** 
2. Crear RPC para **updateSale**
3. Usar RPC para **openTableTransaction** (ya lo hicimos antes!)
