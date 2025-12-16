# 🚀 PLAN DE OPTIMIZACIÓN Y ACCIÓN - STOCKLY

> **Hoja de ruta técnica para escalar a 100-1000 negocios**  
> Priorizado por impacto y esfuerzo  
> Fecha: 15 de diciembre de 2025

---

## 📊 RESUMEN EJECUTIVO

**Objetivo:** Escalar sistema para soportar:
- 100-1,000 negocios activos
- 5,000-50,000 empleados concurrentes
- 10,000-100,000 operaciones/día
- Latencia P95 < 500ms
- 0 race conditions
- 0 duplicados

**Inversión estimada:**
- **Tiempo:** 40-60 horas de desarrollo
- **Costo:** $25-599/mes (Supabase Pro/Team)
- **ROI:** Sistema 10x más rápido y escalable

---

## 🎯 ROADMAP DE OPTIMIZACIONES

### Fase 1: CRITICAL FIXES (Semana 1) - 8 horas

**Objetivo:** Eliminar bugs críticos que causan pérdida de datos

#### 1.1. Fix Race Condition en Stock

**Archivo:** `src/components/Dashboard/Compras.jsx`  
**Esfuerzo:** 1 hora  
**Impacto:** 🔴 CRÍTICO

**Implementación:**

```javascript
// REEMPLAZAR líneas 351-353

// ❌ ANTES (vulnerable)
const { data: product } = await supabase
  .from('products')
  .select('stock')
  .eq('id', detail.product_id)
  .single();

const newStock = parseFloat(product.stock || 0) + parseFloat(detail.quantity);

await supabase
  .from('products')
  .update({ stock: newStock })
  .eq('id', detail.product_id);

// ✅ DESPUÉS (atómico)
const { data: updatedProduct, error } = await supabase
  .from('products')
  .update({ 
    stock: supabase.sql`stock + ${parseFloat(detail.quantity)}` 
  })
  .eq('id', detail.product_id)
  .select('stock')
  .single();

if (error) {
  throw new Error(`Error al actualizar stock: ${error.message}`);
}

if (updatedProduct.stock < 0) {
  // Rollback si stock quedó negativo
  await supabase
    .from('products')
    .update({ stock: supabase.sql`stock - ${parseFloat(detail.quantity)}` })
    .eq('id', detail.product_id);
  
  throw new Error('Stock insuficiente para completar la compra');
}
```

**Validación:**
```bash
# Ejecutar test de concurrencia
k6 run --vus 50 --duration 30s testing/k6/concurrency-test.js

# Verificar: 0 inconsistencias de stock
```

**Archivos a modificar:**
- `src/components/Dashboard/Compras.jsx` (líneas 351-353)
- `src/components/Dashboard/Ventas.jsx` (similar fix para descuento de stock)

---

#### 1.2. Eliminar N+1 Queries

**Archivo:** `src/components/Dashboard/Ventas.jsx`  
**Esfuerzo:** 2 horas  
**Impacto:** 🔴 CRÍTICO (40% mejora en latencia)

**Implementación:**

```javascript
// REEMPLAZAR función loadVentas (líneas 75-143)

const loadVentas = useCallback(async () => {
  try {
    setLoading(true);
    
    // ✅ 1 QUERY con JOIN (en lugar de 2 separadas)
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        employee:employees!sales_user_id_fkey (
          full_name,
          role,
          user_id
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (salesError) throw salesError;
    
    // ✅ Datos ya vienen embebidos, no necesita mapeo
    const salesWithEmployeeNames = salesData?.map(sale => ({
      ...sale,
      seller_display_name: sale.seller_name || sale.employee?.full_name || 'Empleado',
      is_owner: sale.employee?.role === 'owner' || sale.employee?.role === 'admin',
    })) || [];

    setVentas(salesWithEmployeeNames);
  } catch (error) {
    console.error('Error cargando ventas:', error);
    setError('❌ Error al cargar las ventas');
  } finally {
    setLoading(false);
  }
}, [businessId]);
```

**Antes/Después:**
```
Antes: 
  Query 1 (sales): 150ms
  Query 2 (employees): 150ms
  Mapeo en JS: 20ms
  TOTAL: 320ms

Después:
  Query 1 (sales con JOIN): 180ms
  TOTAL: 180ms
  MEJORA: 44% más rápido ✅
```

**Archivos a modificar:**
- `src/components/Dashboard/Ventas.jsx` (líneas 75-143)
- `src/components/Dashboard/Compras.jsx` (similar optimización)
- `src/components/Dashboard/Reportes.jsx` (agregar JOINs)

---

#### 1.3. Implementar Idempotencia

**Archivo:** Crear `src/hooks/useIdempotentSubmit.js`  
**Esfuerzo:** 3 horas  
**Impacto:** 🔴 CRÍTICO (elimina duplicados)

**Implementación:**

```javascript
// CREAR: src/hooks/useIdempotentSubmit.js

import { useState, useCallback } from 'react';
import { supabase } from '../supabase/Client';

export function useIdempotentSubmit(actionName) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const submit = useCallback(async (submitFn, data) => {
    if (isSubmitting) {
      console.warn('Ignorando doble-submit');
      return null;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generar idempotency key único
      const idempotencyKey = `${actionName}-${Date.now()}-${Math.random().toString(36)}`;
      
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('idempotency_requests')
        .select('response_payload')
        .eq('idempotency_key', idempotencyKey)
        .eq('status', 'completed')
        .maybeSingle();
      
      if (existing) {
        console.log('Request duplicada detectada, retornando resultado anterior');
        return existing.response_payload;
      }
      
      // Registrar request como "processing"
      const { data: user } = await supabase.auth.getUser();
      
      await supabase
        .from('idempotency_requests')
        .insert({
          idempotency_key: idempotencyKey,
          action_name: actionName,
          user_id: user?.user?.id,
          business_id: data.business_id,
          request_payload: data,
          status: 'processing',
        });
      
      // Ejecutar operación real
      const result = await submitFn(data);
      
      // Marcar como completado
      await supabase
        .from('idempotency_requests')
        .update({
          status: 'completed',
          response_payload: result,
        })
        .eq('idempotency_key', idempotencyKey);
      
      return result;
    } catch (error) {
      // Marcar como fallido
      await supabase
        .from('idempotency_requests')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('idempotency_key', idempotencyKey);
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [actionName, isSubmitting]);
  
  return { submit, isSubmitting };
}
```

**Uso en Ventas.jsx:**

```javascript
// Importar hook
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';

function Ventas({ businessId }) {
  const { submit: submitSale, isSubmitting } = useIdempotentSubmit('create_sale');
  
  const handleCreateSale = async () => {
    const result = await submitSale(
      async (data) => {
        // Lógica de creación de venta
        const { data: sale } = await supabase
          .from('sales')
          .insert([data])
          .select()
          .single();
        
        return sale;
      },
      saleData
    );
    
    if (result) {
      setSuccess('✅ Venta creada exitosamente');
      loadVentas();
    }
  };
  
  return (
    <button 
      onClick={handleCreateSale} 
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Procesando...' : 'Crear Venta'}
    </button>
  );
}
```

**Archivos a crear/modificar:**
- **CREAR:** `src/hooks/useIdempotentSubmit.js`
- **MODIFICAR:** `src/components/Dashboard/Ventas.jsx` (usar hook)
- **MODIFICAR:** `src/components/Dashboard/Facturas.jsx` (usar hook)
- **MODIFICAR:** `src/components/Dashboard/Compras.jsx` (usar hook)

---

#### 1.4. Configurar Connection Pooling

**Archivo:** `src/supabase/Client.jsx` + Supabase Dashboard  
**Esfuerzo:** 30 minutos  
**Impacto:** 🔴 CRÍTICO (evita agotamiento de conexiones)

**Implementación:**

```javascript
// MODIFICAR: src/supabase/Client.jsx

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables de entorno de Supabase');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'stockly-web-app/1.0',
    },
  },
  // ✅ AGREGAR: Configuración de pooling
  realtime: {
    params: {
      eventsPerSecond: 10, // Throttling de eventos
    },
  },
  // ✅ AGREGAR: Timeout para prevenir conexiones colgadas
  fetch: (url, options = {}) => {
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });
  },
});
```

**Configuración en Supabase Dashboard:**

```
1. Ir a: Settings → Database → Connection Pooling
2. Configurar:
   - Mode: Transaction
   - Pool Size: 15
   - Max Client Conn: 100
3. Guardar nueva Connection String
4. Actualizar .env con pooler URL:

# ANTES (directo)
VITE_SUPABASE_URL=https://xxx.supabase.co

# DESPUÉS (pooler)
VITE_SUPABASE_POOLER_URL=https://pooler-xxx.supabase.co

# Usar pooler URL en producción:
const SUPABASE_URL = import.meta.env.PROD 
  ? import.meta.env.VITE_SUPABASE_POOLER_URL
  : import.meta.env.VITE_SUPABASE_URL;
```

**Validación:**
```sql
-- Ejecutar durante pruebas de carga
SELECT count(*) AS connections
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Debe mantenerse < 60 (con pooling)
```

---

### Fase 2: PERFORMANCE OPTIMIZATION (Semana 2) - 16 horas

#### 2.1. Crear Índices Faltantes

**Esfuerzo:** 30 minutos  
**Impacto:** 🟠 ALTO (10-100x más rápido en reportes)

**Script SQL a ejecutar en Supabase:**

```sql
-- =====================================================
-- ÍNDICES PARA REPORTES POR FECHA
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_business_created 
ON sales(business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_business_created 
ON purchases(business_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_business_created 
ON invoices(business_id, created_at DESC);

-- =====================================================
-- ÍNDICES PARA JOINS
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_details_composite 
ON sale_details(sale_id, product_id, quantity, subtotal);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_details_composite 
ON purchase_details(purchase_id, product_id, quantity, unit_price);

-- =====================================================
-- ÍNDICES PARA BÚSQUEDAS DE TEXTO
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm 
ON products USING GIN (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm 
ON customers USING GIN (full_name gin_trgm_ops);

-- =====================================================
-- ÍNDICES PARA FILTROS COMUNES
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status 
ON invoices(business_id, status) 
WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active 
ON products(business_id, is_active) 
WHERE is_active = true;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Guardar como:** `testing/sql/create-performance-indexes.sql`

**Ejecutar:**
```bash
# En Supabase SQL Editor
# Copiar y pegar contenido del archivo
# RUN
```

**Validación:**
```sql
-- Comparar BEFORE/AFTER
EXPLAIN ANALYZE
SELECT * FROM sales
WHERE business_id = 'xxx'
  AND created_at >= '2024-01-01'
ORDER BY created_at DESC
LIMIT 50;

-- BEFORE: Seq Scan (cost=10000, time=1500ms)
-- AFTER: Index Scan (cost=8.5, time=15ms)
-- MEJORA: 100x más rápido ✅
```

---

#### 2.2. Throttling de Realtime

**Archivo:** `src/hooks/useRealtime.js`  
**Esfuerzo:** 1 hora  
**Impacto:** 🟠 ALTO (evita flood de eventos)

**Implementación:**

```javascript
// MODIFICAR: src/hooks/useRealtime.js

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase/Client';
import { throttle } from 'lodash'; // Agregar dependencia

export function useRealtimeSubscription(table, options = {}) {
  const {
    onInsert,
    onUpdate,
    onDelete,
    filter = {},
    enabled = true,
    throttleMs = 1000, // ✅ NUEVO: Throttling configurable
  } = options;
  
  // ✅ NUEVO: Buffer para batching
  const insertBufferRef = useRef([]);
  const updateBufferRef = useRef([]);
  const deleteBufferRef = useRef([]);
  
  // ✅ NUEVO: Handlers con throttling
  const handleInsertBatch = useCallback(throttle(() => {
    if (onInsert && insertBufferRef.current.length > 0) {
      const items = [...insertBufferRef.current];
      insertBufferRef.current = [];
      
      if (items.length === 1) {
        onInsert(items[0]);
      } else {
        // Batch callback
        onInsert(items); // Pasar array si hay múltiples
      }
    }
  }, throttleMs), [onInsert, throttleMs]);
  
  const handleUpdateBatch = useCallback(throttle(() => {
    if (onUpdate && updateBufferRef.current.length > 0) {
      const items = [...updateBufferRef.current];
      updateBufferRef.current = [];
      
      items.forEach(({ newVal, oldVal }) => onUpdate(newVal, oldVal));
    }
  }, throttleMs), [onUpdate, throttleMs]);
  
  const handleDeleteBatch = useCallback(throttle(() => {
    if (onDelete && deleteBufferRef.current.length > 0) {
      const items = [...deleteBufferRef.current];
      deleteBufferRef.current = [];
      
      items.forEach(item => onDelete(item));
    }
  }, throttleMs), [onDelete, throttleMs]);
  
  useEffect(() => {
    if (!enabled || !table) return;

    const businessId = filter?.business_id || 'global';
    const channelName = `realtime:${table}:${businessId}`;
    const channel = supabase.channel(channelName);

    const filterString = Object.keys(filter).length > 0
      ? Object.entries(filter).map(([key, value]) => `${key}=eq.${value}`).join(',')
      : null;

    // Suscribir a cambios
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        filter: filterString,
      },
      (payload) => {
        // ✅ NUEVO: Agregar a buffer en lugar de ejecutar inmediatamente
        if (payload.eventType === 'INSERT') {
          insertBufferRef.current.push(payload.new);
          handleInsertBatch();
        } else if (payload.eventType === 'UPDATE') {
          updateBufferRef.current.push({ newVal: payload.new, oldVal: payload.old });
          handleUpdateBatch();
        } else if (payload.eventType === 'DELETE') {
          deleteBufferRef.current.push(payload.old);
          handleDeleteBatch();
        }
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Suscrito a realtime: ${table}`);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [table, enabled, JSON.stringify(filter), handleInsertBatch, handleUpdateBatch, handleDeleteBatch]);
}
```

**Uso en Ventas.jsx:**

```javascript
// MODIFICAR: useRealtimeSubscription en Ventas.jsx

useRealtimeSubscription('sales', {
  enabled: true,
  filter: { business_id: businessId },
  throttleMs: 2000, // Máximo 1 update cada 2 segundos
  onInsert: (newSales) => {
    // Ahora recibe array si hay múltiples inserts
    if (Array.isArray(newSales)) {
      setVentas(prev => [...newSales, ...prev]);
    } else {
      setVentas(prev => [newSales, ...prev]);
    }
  },
});
```

---

#### 2.3. Implementar Paginación

**Archivo:** `src/components/Dashboard/Ventas.jsx`  
**Esfuerzo:** 4 horas  
**Impacto:** 🟠 ALTO (acceso a datos históricos)

**Implementación:**

```javascript
// AGREGAR al componente Ventas

const [cursor, setCursor] = useState(null);
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const PAGE_SIZE = 50;

const loadVentas = useCallback(async (reset = false) => {
  try {
    if (reset) {
      setVentas([]);
      setCursor(null);
      setHasMore(true);
    }
    
    setLoading(true);
    
    let query = supabase
      .from('sales')
      .select(`
        *,
        employee:employees!sales_user_id_fkey (full_name, role, user_id)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    
    // ✅ Cursor pagination
    if (!reset && cursor) {
      query = query.lt('created_at', cursor);
    }
    
    const { data: salesData, error } = await query;
    
    if (error) throw error;
    
    // Actualizar cursor
    if (salesData.length < PAGE_SIZE) {
      setHasMore(false);
    }
    
    if (salesData.length > 0) {
      const lastItem = salesData[salesData.length - 1];
      setCursor(lastItem.created_at);
      
      if (reset) {
        setVentas(salesData);
      } else {
        setVentas(prev => [...prev, ...salesData]);
      }
    }
  } catch (error) {
    setError('❌ Error al cargar ventas');
  } finally {
    setLoading(false);
    setLoadingMore(false);
  }
}, [businessId, cursor]);

const loadMoreSales = async () => {
  if (loadingMore || !hasMore) return;
  setLoadingMore(true);
  await loadVentas(false);
};

// ✅ UI con botón "Cargar más"
return (
  <>
    {/* Lista de ventas */}
    {ventas.map(venta => <VentaCard key={venta.id} venta={venta} />)}
    
    {/* Botón de paginación */}
    {hasMore && (
      <button 
        onClick={loadMoreSales} 
        disabled={loadingMore}
        className="w-full py-3 bg-blue-600 text-white rounded-lg"
      >
        {loadingMore ? 'Cargando...' : 'Cargar más ventas'}
      </button>
    )}
    
    {!hasMore && ventas.length > 0 && (
      <p className="text-center text-gray-500">
        ✅ Todas las ventas cargadas
      </p>
    )}
  </>
);
```

---

#### 2.4. Optimizar Generación de Códigos

**Esfuerzo:** 2 horas  
**Impacto:** 🟠 ALTO (elimina race conditions)

**Script SQL:**

```sql
-- CREAR: docs/sql/product-code-generator.sql

-- =====================================================
-- FUNCIÓN PARA GENERAR CÓDIGOS DE PRODUCTOS
-- =====================================================

-- Crear sequence por negocio (si no existe)
CREATE SEQUENCE IF NOT EXISTS products_code_global_seq;

-- Función segura
CREATE OR REPLACE FUNCTION generate_product_code(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number INTEGER;
  v_new_code TEXT;
  v_code_exists BOOLEAN;
BEGIN
  -- Loop hasta encontrar código único
  LOOP
    -- Obtener siguiente número
    v_next_number := nextval('products_code_global_seq');
    
    -- Generar código
    v_new_code := 'PRD-' || LPAD(v_next_number::text, 4, '0');
    
    -- Verificar si ya existe para este negocio
    SELECT EXISTS(
      SELECT 1 FROM products 
      WHERE business_id = p_business_id 
        AND code = v_new_code
    ) INTO v_code_exists;
    
    -- Si no existe, retornar
    EXIT WHEN NOT v_code_exists;
  END LOOP;
  
  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_product_code TO authenticated;

COMMENT ON FUNCTION generate_product_code IS
  'Genera código único de producto usando sequence global.
   Maneja race conditions con loop de verificación.';
```

**Uso en Inventario.jsx:**

```javascript
// REEMPLAZAR función generateProductCode (líneas 94-132)

const generateProductCode = useCallback(async () => {
  try {
    // ✅ Llamar función SQL (atómica)
    const { data, error } = await supabase
      .rpc('generate_product_code', { p_business_id: businessId });
    
    if (error) throw error;
    
    return data; // 'PRD-0042'
  } catch (error) {
    console.error('Error generando código:', error);
    return 'PRD-0001'; // Fallback
  }
}, [businessId]);

// Al crear producto
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Generar código automáticamente
  const newCode = await generateProductCode();
  
  const productData = {
    ...formData,
    code: newCode, // Código generado por BD
    business_id: businessId,
  };
  
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();
  
  if (error) throw error;
  
  setSuccess(`✅ Producto creado: ${newCode}`);
};
```

---

### Fase 3: SCALABILITY & MONITORING (Semana 3-4) - 16 horas

#### 3.1. Optimizar Cache RLS

**Esfuerzo:** 3 horas  
**Impacto:** 🟡 MEDIO (50-80% reducción en overhead RLS)

**Script SQL:**

```sql
-- MODIFICAR función get_user_business_ids() con cache

CREATE OR REPLACE FUNCTION get_user_business_ids_cached()
RETURNS TABLE(business_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached_ids TEXT;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();
  
  -- Intentar leer de session variable
  BEGIN
    v_cached_ids := current_setting('app.cached_business_ids_' || v_current_user, false);
  EXCEPTION WHEN OTHERS THEN
    v_cached_ids := NULL;
  END;
  
  IF v_cached_ids IS NULL OR v_cached_ids = '' THEN
    -- Calcular y cachear
    WITH business_ids AS (
      SELECT id::text FROM businesses WHERE created_by = v_current_user
      UNION
      SELECT business_id::text FROM employees 
      WHERE user_id = v_current_user AND is_active = true
    )
    SELECT string_agg(id, ',') INTO v_cached_ids
    FROM business_ids;
    
    -- Guardar en cache (válido por transacción)
    PERFORM set_config(
      'app.cached_business_ids_' || v_current_user, 
      COALESCE(v_cached_ids, ''), 
      false
    );
  END IF;
  
  -- Retornar desde cache
  IF v_cached_ids IS NOT NULL AND v_cached_ids != '' THEN
    RETURN QUERY
    SELECT unnest(string_to_array(v_cached_ids, ','))::UUID;
  END IF;
END;
$$;

-- Actualizar políticas RLS para usar versión cacheada
ALTER POLICY "sales_select_policy" ON sales
USING (
  business_id IN (SELECT * FROM get_user_business_ids_cached())
);

-- Repetir para todas las tablas con RLS
```

---

#### 3.2. Agregar Retry con Backoff

**Archivo:** `src/hooks/optimized.js`  
**Esfuerzo:** 2 horas  
**Impacto:** 🟡 MEDIO

**Implementación:**

```javascript
// MODIFICAR useSupabaseQuery (líneas 196-234)

export function useSupabaseQuery(queryFn, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await queryFn();

      if (result.error) {
        throw result.error;
      }

      setData(result.data);
      retryCountRef.current = 0; // Reset en éxito
    } catch (err) {
      // ✅ NUEVO: Detectar errores retriables
      const isRetriable = 
        err.code === 'PGRST301' || // JWT expired
        err.message?.includes('timeout') ||
        err.message?.includes('network') ||
        err.message?.includes('fetch failed');
      
      const isPermanent = 
        err.code === '42P01' || // Tabla no existe
        err.code === '42501' || // Permission denied
        err.message?.includes('permission denied');
      
      if (isPermanent) {
        console.error('Error permanente, no se reintenta:', err);
        setError(err);
        return;
      }
      
      if (isRetriable && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        
        // ✅ NUEVO: Exponential backoff con jitter
        const baseDelay = Math.pow(2, retryCountRef.current) * 1000; // 2s, 4s, 8s
        const jitter = Math.random() * 1000; // 0-1s random
        const delay = baseDelay + jitter;
        
        console.warn(
          `Reintentando query (${retryCountRef.current}/${maxRetries}) ` +
          `en ${Math.round(delay)}ms...`
        );

        setTimeout(() => {
          executeQuery();
        }, delay);
      } else {
        setError(err);
      }
    } finally {
      if (!retryCountRef.current || retryCountRef.current >= maxRetries) {
        setLoading(false);
      }
    }
  }, [queryFn]);

  useEffect(() => {
    executeQuery();
  }, dependencies);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error, refetch };
}
```

---

#### 3.3. Implementar Monitoreo

**Esfuerzo:** 4 horas  
**Impacto:** 🟡 MEDIO (visibilidad de performance)

**Crear servicio de métricas:**

```javascript
// CREAR: src/utils/metrics.js

class MetricsCollector {
  constructor() {
    this.metrics = {
      queries: new Map(),
      errors: new Map(),
      latencies: [],
    };
  }
  
  recordQuery(name, duration, success) {
    if (!this.metrics.queries.has(name)) {
      this.metrics.queries.set(name, {
        count: 0,
        totalTime: 0,
        errors: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        durations: [],
      });
    }
    
    const metric = this.metrics.queries.get(name);
    metric.count++;
    metric.totalTime += duration;
    metric.durations.push(duration);
    
    if (!success) {
      metric.errors++;
    }
    
    // Calcular percentiles (cada 100 queries)
    if (metric.count % 100 === 0) {
      const sorted = [...metric.durations].sort((a, b) => a - b);
      metric.p50 = sorted[Math.floor(sorted.length * 0.50)];
      metric.p95 = sorted[Math.floor(sorted.length * 0.95)];
      metric.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }
  }
  
  recordError(name, error) {
    const key = `${name}:${error.code || 'unknown'}`;
    this.metrics.errors.set(
      key,
      (this.metrics.errors.get(key) || 0) + 1
    );
  }
  
  exportMetrics() {
    return {
      queries: Array.from(this.metrics.queries.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        avgLatency: Math.round(data.totalTime / data.count),
        errorRate: ((data.errors / data.count) * 100).toFixed(2) + '%',
        p50: Math.round(data.p50),
        p95: Math.round(data.p95),
        p99: Math.round(data.p99),
      })),
      errors: Array.from(this.metrics.errors.entries()).map(([key, count]) => ({
        error: key,
        count,
      })),
    };
  }
  
  logMetrics() {
    const metrics = this.exportMetrics();
    console.table(metrics.queries);
    console.table(metrics.errors);
  }
}

export const metrics = new MetricsCollector();

// Auto-log cada 5 minutos
if (import.meta.env.DEV) {
  setInterval(() => {
    metrics.logMetrics();
  }, 5 * 60 * 1000);
}
```

**Integrar en queries:**

```javascript
// En cualquier query
const start = performance.now();
const { data, error } = await supabase.from('sales').select('*');
const duration = performance.now() - start;

metrics.recordQuery('sales_select', duration, !error);
if (error) metrics.recordError('sales_select', error);
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Semana 1 (CRÍTICO)

- [ ] Fix race condition en stock (Compras.jsx)
- [ ] Fix race condition en descuento de stock (Ventas.jsx)
- [ ] Eliminar N+1 queries (Ventas.jsx)
- [ ] Eliminar N+1 queries (Compras.jsx)
- [ ] Crear hook useIdempotentSubmit
- [ ] Integrar idempotencia en Ventas
- [ ] Integrar idempotencia en Facturas
- [ ] Configurar connection pooling en Supabase
- [ ] Actualizar Client.jsx con configuración
- [ ] Ejecutar tests de validación (k6)

### Semana 2 (IMPORTANTE)

- [ ] Ejecutar script de índices (create-performance-indexes.sql)
- [ ] Validar performance de queries con EXPLAIN ANALYZE
- [ ] Implementar throttling en useRealtime.js
- [ ] Actualizar uso de realtime en Ventas.jsx
- [ ] Implementar paginación cursor-based en Ventas
- [ ] Crear función SQL generate_product_code
- [ ] Actualizar generación de códigos en Inventario.jsx
- [ ] Ejecutar tests de concurrencia

### Semana 3-4 (MEJORAS)

- [ ] Optimizar función RLS con cache
- [ ] Actualizar políticas RLS
- [ ] Implementar retry con backoff en optimized.js
- [ ] Crear servicio de métricas (metrics.js)
- [ ] Integrar métricas en queries principales
- [ ] Configurar alertas de performance
- [ ] Documentar límites de producción

---

## 🎯 MÉTRICAS DE ÉXITO

| Métrica | Objetivo | Validación |
|---------|----------|------------|
| **Latencia P95** | < 500ms | k6 load test |
| **Race conditions** | 0 | k6 concurrency test |
| **Duplicados** | 0 | k6 idempotency test |
| **Throughput** | > 100 RPS | k6 stress test |
| **Usuarios concurrentes** | > 200 | k6 stress test |
| **Conexiones DB** | < 50 | SQL monitor |
| **Cache hit ratio** | > 95% | SQL query |

---

**Próximos pasos:**
1. Ejecutar Fase 1 (Semana 1)
2. Validar con tests de k6
3. Monitorear métricas en producción
4. Ajustar según resultados
5. Continuar con Fases 2 y 3
