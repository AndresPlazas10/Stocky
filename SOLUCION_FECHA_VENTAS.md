# 🔧 SOLUCIÓN: Fechas en Ventas no se muestran

## Problema encontrado
Las ventas existentes **probablemente tienen `created_at = NULL`** porque:
1. Se insertaron sin que PostgreSQL ejecutara el DEFAULT
2. O RLS estaba bloqueando la escritura del valor

## Solución implementada (3 pasos)

### ✅ PASO 1: Ejecutar FIX SQL en Supabase
Copia-pega este SQL en el **SQL Editor de Supabase** y ejecuta como superusuario:

```sql
-- Asegurar que el DEFAULT está configurado
ALTER TABLE public.sales
ALTER COLUMN created_at SET DEFAULT NOW();

-- Actualizar todos los NULL a ahora (o 1 día atrás)
UPDATE public.sales 
SET created_at = COALESCE(created_at, NOW() - INTERVAL '1 day')
WHERE created_at IS NULL;

-- Agregar constraint para evitar NULL en el futuro
ALTER TABLE public.sales
ALTER COLUMN created_at SET NOT NULL;
```

### ✅ PASO 2: Actualizar el cliente (YA HECHO)
He añadido fallbacks en:
- `src/components/Dashboard/Ventas.jsx` (3 ubicaciones)
- `src/components/Dashboard/VentasNew.jsx` (1 ubicación)

Si `created_at` es null/undefined, mostrará "Fecha no disponible" en lugar de fallar.

### ✅ PASO 3: No enviar `created_at` al insertar (YA HECHO)
En `src/components/Dashboard/Ventas.jsx` línea 374, removí:
```javascript
created_at: new Date().toISOString() // ❌ Eliminado
```

Ahora PostgreSQL maneja automáticamente con `DEFAULT NOW()`.

---

## Verificar que funcionó

### En Supabase SQL Editor:
```sql
-- Ver últimas ventas y sus fechas
SELECT id, created_at, total FROM sales 
ORDER BY created_at DESC 
LIMIT 5;
```

Deberías ver `created_at` con valores reales, no NULL.

### En la app:
1. Ve a **Ventas**
2. Deberías ver las fechas en la lista
3. Crea una venta nueva
4. La fecha debe aparecer inmediatamente

---

## Si sigue sin funcionar

Ejecuta en SQL Editor:
```sql
-- Ver estado actual
SELECT 
  COUNT(*) as total_sales,
  COUNT(created_at) as with_date,
  COUNT(*) - COUNT(created_at) as still_null
FROM sales;
```

Si hay muchos NULL aún, ejecuta:
```sql
UPDATE sales 
SET created_at = NOW() 
WHERE created_at IS NULL;
```

---

## Archivos modificados
- [src/components/Dashboard/Ventas.jsx](src/components/Dashboard/Ventas.jsx) - Fallbacks para fecha
- [src/components/Dashboard/VentasNew.jsx](src/components/Dashboard/VentasNew.jsx) - Fallback para fecha
- [docs/sql/FIX_SALES_CREATED_AT.sql](docs/sql/FIX_SALES_CREATED_AT.sql) - Script SQL definitivo
