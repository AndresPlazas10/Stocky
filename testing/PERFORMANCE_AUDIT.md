# 🔥 AUDITORÍA DE RENDIMIENTO Y CARGA - STOCKLY

> **Análisis técnico profundo de performance, seguridad y escalabilidad**
> Fecha: 15 de diciembre de 2025
> Tipo: Análisis de arquitectura backend, frontend y base de datos

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual del Sistema
- **Arquitectura**: React + Vite + Supabase (PostgreSQL)
- **Modelo de datos**: Multi-tenant (RLS)
- **Operaciones críticas**: Ventas, Inventario, Empleados, Facturación
- **Conexiones concurrentes**: Sin límites implementados
- **Índices**: ✅ Implementados (23 índices totales)
- **RLS**: ✅ Activo en todas las tablas

### Problemas Críticos Identificados

| Severidad | Problema | Impacto | Línea de Código |
|-----------|----------|---------|-----------------|
| 🔴 **CRÍTICO** | N+1 queries en ventas | 50+ queries por carga | `Ventas.jsx:82-103` |
| 🔴 **CRÍTICO** | Sin límites de paginación | OOM con +1000 ventas | `Ventas.jsx:85 limit(50)` |
| 🔴 **CRÍTICO** | Race condition en stock | Inventario negativo | `Compras.jsx:351-353` |
| 🟠 **ALTO** | Queries sin índices en filtros | Latencia >500ms | `Reportes.jsx:78-140` |
| 🟠 **ALTO** | Realtime sin throttling | Flood de eventos | `useRealtime.js:19-70` |
| 🟠 **ALTO** | Sin connection pooling | Límite de 60 conexiones | `Client.jsx:20-33` |
| 🟡 **MEDIO** | Generate code con loop | 100+ queries posibles | `Inventario.jsx:94-132` |
| 🟡 **MEDIO** | Sin retry exponencial | Fallos en alta carga | `optimized.js:196-234` |

---

## 🎯 ESCENARIOS DE PRUEBA

### Escenario Base: Simulación Realista

```
Configuración:
- 100 negocios activos
- 20 empleados por negocio (promedio)
- 500 productos por negocio
- 10,000 ventas históricas totales
- 50 operaciones concurrentes/segundo (pico)

Total usuarios concurrentes: 2,000
Total requests/segundo: 50 RPS
Duración de prueba: 30 minutos
```

### Distribución de Carga Esperada

```
40% - Consultas (SELECT)
30% - Ventas (INSERT sales + sale_details)
15% - Inventario (UPDATE products stock)
10% - Reportes (SELECT con aggregations)
5% - Empleados/Config (INSERT/UPDATE)
```

---

## 🧪 PLAN DE PRUEBAS DETALLADO

### 1️⃣ PRUEBAS DE CARGA (Load Testing)

#### Objetivo
Validar comportamiento bajo carga normal en horas pico.

#### Configuración k6

```javascript
// load-test-ventas.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const failureRate = new Rate('failed_requests');
const latencyTrend = new Trend('request_latency');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Calentamiento
    { duration: '5m', target: 50 },   // Carga normal
    { duration: '10m', target: 50 },  // Sostenida
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms
    http_req_failed: ['rate<0.01'],                  // < 1% errores
    failed_requests: ['rate<0.05'],                  // < 5% fallos lógicos
  },
};

// Setup: Autenticación
export function setup() {
  const loginRes = http.post(`${__ENV.API_URL}/auth/v1/token`, {
    email: 'test@stockly.com',
    password: 'test1234',
    grant_type: 'password',
  }, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return { token: loginRes.json('access_token') };
}

export default function (data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
      'apikey': __ENV.SUPABASE_ANON_KEY,
    },
  };
  
  // TEST 1: Listar ventas (operación más común)
  const salesRes = http.get(
    `${__ENV.API_URL}/rest/v1/sales?business_id=eq.${__ENV.BUSINESS_ID}&order=created_at.desc&limit=50`,
    params
  );
  
  check(salesRes, {
    'status 200': (r) => r.status === 200,
    'response < 500ms': (r) => r.timings.duration < 500,
    'tiene datos': (r) => r.json().length > 0,
  });
  
  latencyTrend.add(salesRes.timings.duration);
  failureRate.add(salesRes.status !== 200);
  
  sleep(1);
  
  // TEST 2: Crear venta (operación crítica)
  const saleData = {
    business_id: __ENV.BUSINESS_ID,
    user_id: __ENV.USER_ID,
    seller_name: 'Empleado Test',
    total: 15000,
    payment_method: 'cash',
  };
  
  const createRes = http.post(
    `${__ENV.API_URL}/rest/v1/sales`,
    JSON.stringify(saleData),
    params
  );
  
  check(createRes, {
    'venta creada': (r) => r.status === 201,
    'INSERT < 300ms': (r) => r.timings.duration < 300,
  });
  
  sleep(2);
}
```

#### Métricas Esperadas

| Métrica | Objetivo | Umbral Fallo |
|---------|----------|--------------|
| **P50 latency** | < 200ms | > 400ms |
| **P95 latency** | < 500ms | > 1000ms |
| **P99 latency** | < 1000ms | > 2000ms |
| **Error rate** | < 1% | > 5% |
| **Throughput** | > 45 RPS | < 30 RPS |
| **DB connections** | < 40 | > 55 |

#### Problemas Esperados

1. **N+1 en ventas**: Cargar 50 ventas = 50 + 1 queries (employees join)
2. **Missing indexes**: Filtros por fecha sin índice compuesto
3. **RLS overhead**: Cada query ejecuta subquery `get_user_business_ids()`

---

### 2️⃣ PRUEBAS DE ESTRÉS (Stress Testing)

#### Objetivo
Romper el sistema para encontrar límites reales.

#### Configuración k6

```javascript
// stress-test.js
export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 200 },   // Degradación esperada aquí
    { duration: '5m', target: 300 },   // Sistema debería fallar
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],  // Más tolerante
    http_req_failed: ['rate<0.30'],     // 30% fallos aceptable en stress
  },
};

export default function (data) {
  // Mix realista de operaciones
  const operation = Math.random();
  
  if (operation < 0.40) {
    // 40%: Consultas simples
    testListSales(data);
  } else if (operation < 0.70) {
    // 30%: Crear ventas
    testCreateSale(data);
  } else if (operation < 0.85) {
    // 15%: Actualizar inventario
    testUpdateStock(data);
  } else {
    // 10%: Reportes pesados
    testHeavyReport(data);
  }
  
  sleep(0.5); // Mayor frecuencia = más estrés
}

function testHeavyReport(data) {
  // Reporte con JOIN y agregaciones
  const query = `
    select=*,
    sale_details(quantity,subtotal,product:products(name,category)),
    created_at.gte.2024-01-01
  `;
  
  http.get(
    `${__ENV.API_URL}/rest/v1/sales?${query}`,
    { headers: data.headers }
  );
}
```

#### Degradación Esperada

```
50 VUs:  Sistema estable, < 300ms latencia
100 VUs: Aumento a 500-800ms, sin errores
200 VUs: Latencia 1-2s, errores < 5%
300 VUs: 🔴 Timeouts, errores > 20%, conexiones agotadas
```

#### Cuellos de Botella Predichos

1. **Conexiones Supabase**: Límite de 60 (plan gratuito)
2. **RLS recursión**: `get_user_business_ids()` ejecutado miles de veces
3. **Missing connection pool**: Cada request = nueva conexión
4. **Sin caching**: Queries repetidas no se cachean

---

### 3️⃣ PRUEBAS DE CONCURRENCIA

#### Objetivo
Validar race conditions en operaciones críticas.

#### Script SQL Concurrente

```sql
-- concurrent-stock-test.sql
-- Ejecutar 20 veces en paralelo desde terminales diferentes

BEGIN;

-- 1. Leer stock actual
SELECT stock FROM products WHERE id = 'PRODUCT_UUID' FOR UPDATE;

-- Simular procesamiento (50ms)
SELECT pg_sleep(0.05);

-- 2. Actualizar stock (VULNERABLE A RACE CONDITION)
UPDATE products 
SET stock = stock - 10 
WHERE id = 'PRODUCT_UUID';

COMMIT;
```

#### Casos de Prueba

**Caso 1: Venta Concurrente**
```javascript
// Ejecutar 100 ventas simultáneas del mismo producto
Promise.all(
  Array.from({ length: 100 }, () =>
    supabase.from('sales').insert([{
      business_id: BUSINESS_ID,
      total: 1000,
      // ... otros campos
    }]).then(() =>
      supabase.from('products')
        .update({ stock: stock - 1 })
        .eq('id', PRODUCT_ID)
    )
  )
)
```

**Resultado Esperado sin Fix:**
- Stock inicial: 100
- Stock esperado: 0
- **Stock real: 85-95** ❌ (race condition)

**Fix Requerido:**
```sql
-- Usar UPDATE atómico
UPDATE products 
SET stock = stock - $1 
WHERE id = $2 AND stock >= $1
RETURNING stock;
```

**Caso 2: Código de Producto Duplicado**

Ejecutar 50 creaciones concurrentes:
```javascript
Promise.all(
  Array.from({ length: 50 }, () =>
    // Problema: generateProductCode() hace SELECT + INSERT
    generateProductCode().then(code =>
      supabase.from('products').insert({ code, ... })
    )
  )
)
```

**Resultado Esperado:**
- Códigos únicos: 50
- **Códigos duplicados: 5-10** ❌ (UNIQUE constraint violation)

**Fix Requerido:**
```sql
-- Usar SEQUENCE PostgreSQL
CREATE SEQUENCE products_seq_per_business_{business_id};

-- Generar código en base de datos
CREATE FUNCTION generate_product_code(p_business_id UUID)
RETURNS TEXT AS $$
  SELECT 'PRD-' || LPAD(
    nextval('products_seq_' || REPLACE(p_business_id::text, '-', ''))::text,
    4, '0'
  );
$$ LANGUAGE SQL;
```

---

### 4️⃣ PRUEBAS DE IDEMPOTENCIA

#### Objetivo
Validar que doble-submit no crea datos duplicados.

#### Script de Prueba

```javascript
// idempotency-test.js
import http from 'k6/http';

export default function() {
  const idempotencyKey = `sale-${Date.now()}-${__VU}`;
  const saleData = {
    business_id: __ENV.BUSINESS_ID,
    total: 5000,
    payment_method: 'cash',
  };
  
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Idempotency-Key': idempotencyKey, // ⚠️ NO IMPLEMENTADO
    },
  };
  
  // Enviar 3 veces la misma request
  const responses = [
    http.post(`${__ENV.API_URL}/rest/v1/sales`, JSON.stringify(saleData), params),
    http.post(`${__ENV.API_URL}/rest/v1/sales`, JSON.stringify(saleData), params),
    http.post(`${__ENV.API_URL}/rest/v1/sales`, JSON.stringify(saleData), params),
  ];
  
  // Verificar:
  // - Primera request: 201 Created
  // - Segunda/Tercera: 200 OK (mismo resultado)
  check(responses[0], { '1ra request 201': (r) => r.status === 201 });
  check(responses[1], { '2da request 200': (r) => r.status === 200 });
  check(responses[2], { '3ra request 200': (r) => r.status === 200 });
  
  // IDs deben ser iguales
  const ids = responses.map(r => r.json('id'));
  check(ids, { 'IDs iguales': () => ids[0] === ids[1] && ids[1] === ids[2] });
}
```

#### Problema Actual

⚠️ **NO existe implementación de idempotencia en frontend**

Código actual en `Ventas.jsx:393`:
```javascript
const { data: sale, error: saleError } = await supabase
  .from('sales')
  .insert([saleData])
  .select()
  .single();
```

**Resultado con doble-click:**
- 2 ventas idénticas creadas ❌
- Stock descontado 2 veces ❌

#### Fix Implementado (Disponible)

Ya existe `idempotency_requests` tabla, pero **NO está integrada en frontend**.

**Implementación requerida:**
```javascript
// Hook personalizado
async function createSaleIdempotent(saleData) {
  const idempotencyKey = `sale-${saleData.business_id}-${Date.now()}-${Math.random()}`;
  
  // 1. Verificar si ya existe
  const { data: existing } = await supabase
    .from('idempotency_requests')
    .select('response_payload')
    .eq('idempotency_key', idempotencyKey)
    .eq('status', 'completed')
    .maybeSingle();
  
  if (existing) {
    return existing.response_payload; // Retornar resultado anterior
  }
  
  // 2. Crear request idempotente
  const { data: request } = await supabase
    .from('idempotency_requests')
    .insert({
      idempotency_key: idempotencyKey,
      action_name: 'create_sale',
      user_id: user.id,
      business_id: saleData.business_id,
      request_payload: saleData,
      status: 'processing',
    })
    .select()
    .single();
  
  try {
    // 3. Ejecutar operación
    const { data: sale } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();
    
    // 4. Marcar como completado
    await supabase
      .from('idempotency_requests')
      .update({
        status: 'completed',
        response_payload: sale,
      })
      .eq('id', request.id);
    
    return sale;
  } catch (error) {
    // 5. Marcar como fallido
    await supabase
      .from('idempotency_requests')
      .update({
        status: 'failed',
        error_message: error.message,
      })
      .eq('id', request.id);
    
    throw error;
  }
}
```

---

### 5️⃣ PRUEBAS DE BASE DE DATOS

#### Objetivo
Validar locks, deadlocks y rendimiento de queries.

#### Test 1: Lock Monitoring

```sql
-- monitor-locks.sql
-- Ejecutar durante pruebas de carga

SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  blocked_activity.application_name
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Salida Esperada:**
- Sin carga: 0 locks bloqueados
- Carga normal (50 VUs): 0-2 locks ocasionales
- Carga alta (200 VUs): **10-30 locks** ⚠️ (problema)

#### Test 2: Queries Lentas

```sql
-- slow-queries.sql
-- Habilitar logging de queries lentas

ALTER DATABASE postgres SET log_min_duration_statement = 500; -- Logear queries > 500ms

-- Luego ejecutar test de carga

-- Analizar queries lentas
SELECT 
  calls,
  mean_exec_time::numeric(10,2) AS avg_ms,
  max_exec_time::numeric(10,2) AS max_ms,
  total_exec_time::numeric(10,2) AS total_ms,
  query
FROM pg_stat_statements
WHERE mean_exec_time > 500
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Queries Lentas Esperadas:**

1. **Reportes con JOIN múltiple** (1000-2000ms)
```sql
SELECT s.*, sd.*, p.* 
FROM sales s 
JOIN sale_details sd ON sd.sale_id = s.id
JOIN products p ON p.id = sd.product_id
WHERE s.business_id = 'xxx'
AND s.created_at >= '2024-01-01';
-- Missing index: (business_id, created_at)
```

2. **Búsqueda de productos sin GIN index** (500-1000ms)
```sql
SELECT * FROM products 
WHERE business_id = 'xxx' 
AND name ILIKE '%producto%';
-- Necesita: CREATE INDEX USING GIN (name gin_trgm_ops)
```

#### Test 3: Deadlocks

```sql
-- deadlock-simulator.sql
-- Terminal 1:
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_A';
-- Esperar 2 segundos
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_B';
COMMIT;

-- Terminal 2 (ejecutar al mismo tiempo):
BEGIN;
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_B';
-- Esperar 2 segundos
UPDATE products SET stock = stock - 1 WHERE id = 'PRODUCT_A';
COMMIT;

-- Resultado: DEADLOCK detectado
```

**Detección de deadlocks:**
```sql
SELECT * FROM pg_stat_database_conflicts WHERE datname = 'postgres';
```

#### Test 4: Impacto RLS

```sql
-- rls-overhead-test.sql
-- Comparar con/sin RLS

-- CON RLS (estado actual)
EXPLAIN ANALYZE
SELECT * FROM sales WHERE business_id = 'xxx' LIMIT 50;

-- SIN RLS (test)
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
EXPLAIN ANALYZE
SELECT * FROM sales WHERE business_id = 'xxx' LIMIT 50;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
```

**Overhead Esperado:**
- Sin RLS: 10-20ms
- Con RLS: **50-100ms** (5x más lento)
- Causa: Subquery `get_user_business_ids()` en cada SELECT

---

### 6️⃣ PRUEBAS DE SEGURIDAD BAJO CARGA

#### Objetivo
Validar que RLS no permite accesos cruzados bajo alta concurrencia.

#### Test: Cross-Tenant Access

```javascript
// security-test.js
export default function() {
  // Usuario 1: Negocio A
  const token1 = loginAs('user1@test.com');
  
  // Usuario 2: Negocio B
  const token2 = loginAs('user2@test.com');
  
  // Usuario 1 intenta acceder a ventas de Negocio B
  const maliciousRes = http.get(
    `${__ENV.API_URL}/rest/v1/sales?business_id=eq.${BUSINESS_B}`,
    { headers: { 'Authorization': `Bearer ${token1}` } }
  );
  
  check(maliciousRes, {
    'No acceso cross-tenant': (r) => r.json().length === 0,
  });
}
```

**Casos de fallo RLS bajo carga:**

1. **Race condition en RLS check:**
   - 1000 requests concurrentes
   - RLS evalúa `auth.uid()` en momento incorrecto
   - **Resultado:** Posible leak de datos ⚠️

2. **Cache de RLS políticas:**
   - Supabase cachea resultados de `get_user_business_ids()`
   - Si cambia rol de empleado, cache stale
   - **Resultado:** Empleado desactivado puede seguir viendo datos

#### Test: Token Expiration Durante Operación

```javascript
// Test: Token expira a mitad de venta
async function testExpiredToken() {
  const { data: session } = await supabase.auth.getSession();
  
  // Forzar expiración (cambiar system time)
  // Intentar crear venta
  const { error } = await supabase.from('sales').insert([...]);
  
  // Debe retornar 401 Unauthorized
  expect(error.code).toBe('PGRST301'); // JWT expired
}
```

**Problema Actual:**
- Frontend no maneja re-autenticación automática
- Operaciones críticas (ventas) pueden fallar silenciosamente

---

### 7️⃣ PRUEBAS DE RESILIENCIA

#### Objetivo
Validar recuperación ante fallos parciales.

#### Test 1: Latencia Artificial

```javascript
// latency-test.js
// Simular latencia de red variable

import { sleep } from 'k6';

export default function() {
  const latency = Math.random() * 2000; // 0-2000ms random
  
  const start = Date.now();
  const res = http.get(`${__ENV.API_URL}/rest/v1/sales?limit=10`);
  const realLatency = Date.now() - start;
  
  if (realLatency > 3000) {
    // Simular timeout del cliente
    console.error('Timeout simulado');
    return;
  }
  
  check(res, {
    'Maneja latencia alta': (r) => r.status === 200,
  });
}
```

#### Test 2: Reintentos Automáticos

```javascript
// retry-test.js
// Validar exponential backoff

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await http.get(url);
      if (res.status === 200) return res;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      sleep(delay / 1000);
    }
  }
}
```

**Problema Actual:**
- Hook `useSupabaseQuery` tiene retry simple (línea 196-234)
- **Falta:** Backoff exponencial, jitter, retry condicional

#### Test 3: Caída Parcial de Supabase

```bash
# Simular caída de Supabase REST API (no realtime)
# Usar proxy o network throttling

# Desactivar REST API
curl -X POST https://api.supabase.com/projects/{project}/pause

# Validar que frontend muestra error user-friendly
# NO debe: Quedar cargando indefinidamente
# DEBE: Mostrar "Servicio temporalmente no disponible"
```

---

## 📈 MÉTRICAS CLAVE A RECOLECTAR

### Métricas de Aplicación

```javascript
// Instrumentación frontend (agregar a components)
import { metrics } from './utils/metrics';

const startTime = performance.now();
await supabase.from('sales').select('*');
const duration = performance.now() - startTime;

metrics.recordQueryLatency('sales_select', duration);
metrics.recordQueryCount('sales_select');
```

### Métricas de Base de Datos

```sql
-- Ejecutar cada 30 segundos durante pruebas

-- 1. Conexiones activas
SELECT 
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE datname = 'postgres';

-- 2. Locks activos
SELECT count(*) AS locks_held
FROM pg_locks
WHERE NOT granted;

-- 3. Tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. Cache hit ratio
SELECT 
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100 AS cache_hit_ratio
FROM pg_statio_user_tables;
```

### Dashboard de Métricas

```javascript
// metrics-dashboard.js
// Real-time dashboard con Grafana o custom

export const metrics = {
  // Frontend
  queryLatency: new Map(), // query_name -> [latencies]
  queryCounts: new Map(),
  errorRates: new Map(),
  
  // Backend (Supabase)
  dbConnections: [],
  dbLatency: [],
  cacheHitRatio: [],
  
  // Business
  salesPerMinute: [],
  activeUsers: [],
};

// Exportar a Prometheus format
export function exportMetrics() {
  return `
# HELP query_latency_ms Query latency in milliseconds
# TYPE query_latency_ms histogram
query_latency_ms_bucket{query="sales_select",le="100"} 45
query_latency_ms_bucket{query="sales_select",le="500"} 95
query_latency_ms_bucket{query="sales_select",le="1000"} 98
query_latency_ms_bucket{query="sales_select",le="+Inf"} 100
  `;
}
```

---

## 🎯 RESULTADOS ESPERADOS vs FALLOS ACEPTABLES

### Tabla de Tolerancia

| Escenario | Métrica | Objetivo | Aceptable | Fallo |
|-----------|---------|----------|-----------|-------|
| **Load Test (50 VUs)** | P95 latency | < 300ms | < 500ms | > 1000ms |
| | Error rate | < 0.5% | < 2% | > 5% |
| | Throughput | > 45 RPS | > 35 RPS | < 25 RPS |
| **Stress Test (200 VUs)** | P95 latency | < 1000ms | < 2000ms | > 5000ms |
| | Error rate | < 5% | < 15% | > 30% |
| | Degradación | Lineal | Gradual | Colapso |
| **Concurrency Test** | Race conditions | 0 | 0 | > 0 |
| | Duplicados | 0 | 0 | > 0 |
| | Stock negativo | 0 | 0 | > 0 |
| **DB Performance** | Connections | < 30 | < 50 | > 60 |
| | Locks | < 5 | < 20 | > 50 |
| | Cache hit | > 95% | > 85% | < 70% |

### Criterios de Éxito

✅ **Sistema APRUEBA si:**
- Soporta 50 VUs concurrentes con < 500ms latencia P95
- Maneja 1000 ventas/hora sin errores
- No permite accesos cross-tenant (0 leaks)
- Recupera de fallos en < 5 segundos
- Stock siempre correcto (0 race conditions)

❌ **Sistema FALLA si:**
- Colapsa con < 100 VUs
- Error rate > 5% bajo carga normal
- Permite acceso cross-tenant
- Stock negativo o duplicados detectados
- Deadlocks frecuentes (> 1 por hora)

---

## 🔥 PROBLEMAS REALES ENCONTRADOS EN CÓDIGO

### 1. N+1 Queries en Ventas

**Archivo:** `src/components/Dashboard/Ventas.jsx`  
**Líneas:** 82-103  
**Severidad:** 🔴 CRÍTICO

**Problema:**
```javascript
// Carga ventas
const { data: salesData } = await supabase
  .from('sales')
  .select('*, seller_name')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(50);

// Luego carga empleados separado
const { data: employeesData } = await supabase
  .from('employees')
  .select('user_id, full_name, role')
  .eq('business_id', businessId);

// Mapea manualmente
employeesData?.forEach(emp => {
  employeeMap.set(emp.user_id, { ... });
});
```

**Impacto:**
- 2 queries separadas + mapeo en memoria
- Con realtime: cada INSERT activa loadVentas() → 2 queries más
- **100 ventas/hora = 200 queries innecesarias**

**Fix:**
```javascript
// 1 sola query con JOIN
const { data: salesData } = await supabase
  .from('sales')
  .select(`
    *,
    employee:employees!sales_user_id_fkey (
      full_name,
      role
    )
  `)
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(50);

// Ya viene embebido
// salesData[0].employee.full_name ✅
```

---

### 2. Race Condition en Stock

**Archivo:** `src/components/Dashboard/Compras.jsx`  
**Líneas:** 351-353  
**Severidad:** 🔴 CRÍTICO

**Problema:**
```javascript
// VULNERABLE: Read → Modify → Write
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
```

**Caso de Fallo:**
```
Tiempo  | Thread A           | Thread B           | Stock DB
--------|--------------------|--------------------|----------
T0      | Read stock=100     |                    | 100
T1      |                    | Read stock=100     | 100
T2      | newStock=110       |                    | 100
T3      |                    | newStock=105       | 100
T4      | UPDATE stock=110   |                    | 110
T5      |                    | UPDATE stock=105   | 105 ❌

Resultado: Thread B sobrescribe Thread A
Stock esperado: 115
Stock real: 105 (pérdida de 10 unidades)
```

**Fix:**
```javascript
// UPDATE atómico
const { data, error } = await supabase
  .from('products')
  .update({ 
    stock: supabase.sql`stock + ${detail.quantity}` 
  })
  .eq('id', detail.product_id)
  .select()
  .single();

if (error) {
  throw new Error('No se pudo actualizar stock');
}
```

**Aún mejor: Trigger de base de datos**
```sql
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_purchase_detail_insert
AFTER INSERT ON purchase_details
FOR EACH ROW
EXECUTE FUNCTION update_product_stock();
```

---

### 3. Generación de Código Ineficiente

**Archivo:** `src/components/Dashboard/Inventario.jsx`  
**Líneas:** 94-132  
**Severidad:** 🟡 MEDIO

**Problema:**
```javascript
const generateProductCode = useCallback(async () => {
  try {
    // Query TODOS los códigos
    const { data: products } = await supabase
      .from('products')
      .select('code')
      .eq('business_id', businessId)
      .ilike('code', 'PRD-%');

    // Parsear en JavaScript
    const maxNumber = products.reduce((max, p) => {
      const num = parseInt(p.code.split('-')[1]);
      return num > max ? num : max;
    }, 0);

    return `PRD-${String(maxNumber + 1).padStart(4, '0')}`;
  } catch (error) {
    return 'PRD-0001';
  }
}, [businessId]);
```

**Impacto:**
- **Escanea toda la tabla** (con 10,000 productos = query de 10MB)
- Procesamiento en cliente (lento)
- No atómico: race condition posible

**Fix: Usar PostgreSQL Sequence**
```sql
-- Crear sequence por negocio
CREATE SEQUENCE products_code_seq;

-- Función para generar código
CREATE OR REPLACE FUNCTION generate_product_code(p_business_id UUID)
RETURNS TEXT AS $$
  SELECT 'PRD-' || LPAD(nextval('products_code_seq')::text, 4, '0');
$$ LANGUAGE SQL;
```

```javascript
// Frontend simplificado
const { data, error } = await supabase
  .rpc('generate_product_code', { p_business_id: businessId });

const newCode = data; // 'PRD-0042'
```

**Beneficios:**
- ✅ 1 query vs 1 scan completo
- ✅ Atómico (sin race conditions)
- ✅ Escalable (10M productos = mismo performance)

---

### 4. Realtime Sin Throttling

**Archivo:** `src/hooks/useRealtime.js`  
**Líneas:** 19-70  
**Severidad:** 🟠 ALTO

**Problema:**
```javascript
channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: table }, (payload) => {
  if (onInsert) onInsert(payload.new); // Se ejecuta INMEDIATAMENTE
});
```

**Impacto:**
- **100 inserts concurrentes = 100 llamadas a onInsert**
- Cada onInsert puede disparar setState → 100 re-renders
- Frontend se congela

**Caso Real:**
```javascript
// Ventas.jsx línea 203
onInsert: (newSale) => {
  setVentas(prev => [newSale, ...prev]); // Re-render
  loadVentas(); // Query completa de nuevo ❌❌
}
```

**Fix: Throttling + Batching**
```javascript
import { throttle } from 'lodash';

const handleInserts = useMemo(() => {
  let buffer = [];
  
  return throttle(() => {
    if (buffer.length === 0) return;
    
    setVentas(prev => [...buffer, ...prev]);
    buffer = [];
  }, 1000); // Máximo 1 update/segundo
}, []);

channel.on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
  buffer.push(payload.new);
  handleInserts();
});
```

---

### 5. Sin Paginación Real

**Archivo:** `src/components/Dashboard/Ventas.jsx`  
**Línea:** 85  
**Severidad:** 🔴 CRÍTICO

**Problema:**
```javascript
.select('*, seller_name')
.eq('business_id', businessId)
.order('created_at', { ascending: false })
.limit(50); // Siempre primeros 50
```

**No hay:**
- Paginación (prev/next)
- Infinite scroll
- Cursor-based pagination

**Impacto:**
- Usuario solo ve últimas 50 ventas
- No puede ver ventas antiguas
- Con 10,000 ventas: **99.5% de datos inaccesibles**

**Fix: Cursor Pagination**
```javascript
const [cursor, setCursor] = useState(null);
const PAGE_SIZE = 50;

const loadMoreSales = async () => {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  
  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  
  const { data } = await query;
  
  if (data.length > 0) {
    setCursor(data[data.length - 1].created_at);
    setVentas(prev => [...prev, ...data]);
  }
};

// UI
<button onClick={loadMoreSales}>
  Cargar más ventas
</button>
```

---

### 6. Missing Indexes en Reportes

**Archivo:** `src/components/Dashboard/Reportes.jsx`  
**Líneas:** 78-140  
**Severidad:** 🟠 ALTO

**Queries sin índices:**

```javascript
// 1. Rango de fechas sin índice compuesto
.from('sales')
.gte('created_at', startDate)
.lte('created_at', endDate);
// Necesita: idx_sales_business_created (business_id, created_at)

// 2. Join con aggregations
.from('sale_details')
.select('*, product:products(name, category)')
// Necesita: idx_sale_details_product (product_id, sale_id)
```

**EXPLAIN ANALYZE:**
```sql
Seq Scan on sales  (cost=0.00..10000.00 rows=10000 width=128)
  Filter: (created_at >= '2024-01-01' AND created_at <= '2024-12-31')
```

**Con índice:**
```sql
Index Scan using idx_sales_business_created on sales  
  (cost=0.28..8.50 rows=10 width=128)
  Index Cond: (business_id = 'xxx' AND created_at >= '2024-01-01')
```

**Performance:**
- Sin índice: 500-2000ms
- Con índice: 10-50ms

---

## 🔧 RECOMENDACIONES DE OPTIMIZACIÓN

### Backend (Supabase)

#### 1. Índices Faltantes

```sql
-- Ejecutar en Supabase SQL Editor

-- Reportes por fecha
CREATE INDEX idx_sales_business_created 
ON sales(business_id, created_at DESC);

CREATE INDEX idx_purchases_business_created 
ON purchases(business_id, created_at DESC);

-- Búsqueda de productos
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm 
ON products USING GIN (name gin_trgm_ops);

-- Filtros de status
CREATE INDEX idx_invoices_business_status 
ON invoices(business_id, status) WHERE status != 'cancelled';

-- Aggregations
CREATE INDEX idx_sale_details_product_composite 
ON sale_details(product_id, sale_id, quantity, subtotal);
```

#### 2. Funciones Optimizadas

```sql
-- Reemplazar get_user_business_ids() con cache
CREATE OR REPLACE FUNCTION get_user_business_ids_cached()
RETURNS TABLE(business_id UUID)
LANGUAGE sql
STABLE -- ⚡ Cacheable dentro de la misma transacción
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  SELECT business_id FROM employees 
  WHERE user_id = auth.uid() AND is_active = true;
$$;
```

#### 3. Connection Pooling

```javascript
// Client.jsx - Configuración optimizada
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'stockly-web-app',
    },
  },
  // ⚡ NUEVO: Connection pooling
  realtime: {
    params: {
      eventsPerSecond: 10, // Throttling
    },
  },
});
```

**Mejor: Usar Supabase connection pooler**
```
Database URL: postgres://...@db.xxx.supabase.co:5432/postgres
Pooler URL:   postgres://...@pooler.xxx.supabase.co:6543/postgres
              ^^^^^^^^ Usar este para mejor performance
```

---

### Frontend (React)

#### 1. Query Optimization

```javascript
// Usar React Query o SWR para caching
import { useQuery } from '@tanstack/react-query';

function useVentas(businessId) {
  return useQuery({
    queryKey: ['sales', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select(`
          *,
          employee:employees!sales_user_id_fkey(full_name, role)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data;
    },
    staleTime: 30000, // Cache por 30s
    cacheTime: 300000, // Mantener en cache 5min
  });
}
```

#### 2. Optimistic Updates

```javascript
// Actualizar UI antes de confirmar con DB
const handleCreateSale = async (saleData) => {
  // 1. Actualizar UI inmediatamente
  const tempId = `temp-${Date.now()}`;
  setVentas(prev => [{ ...saleData, id: tempId }, ...prev]);
  
  try {
    // 2. Persistir en DB
    const { data: sale } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();
    
    // 3. Reemplazar temp con real
    setVentas(prev => prev.map(v => 
      v.id === tempId ? sale : v
    ));
  } catch (error) {
    // 4. Rollback en caso de error
    setVentas(prev => prev.filter(v => v.id !== tempId));
    throw error;
  }
};
```

#### 3. Debouncing Búsquedas

```javascript
// Búsqueda de productos
import { useDebouncedValue } from '@mantine/hooks';

const [search, setSearch] = useState('');
const [debouncedSearch] = useDebouncedValue(search, 300);

useEffect(() => {
  if (debouncedSearch.length > 2) {
    searchProducts(debouncedSearch);
  }
}, [debouncedSearch]);

// Antes: 1 query por cada tecla (10 queries = "smartphone")
// Después: 1 query total ✅
```

---

### Base de Datos

#### 1. Particionamiento (Opcional para escala futura)

```sql
-- Particionar sales por mes (solo si > 10M registros)
CREATE TABLE sales_2024_01 PARTITION OF sales
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE sales_2024_02 PARTITION OF sales
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

#### 2. Archivado de Datos Antiguos

```sql
-- Mover ventas > 2 años a tabla archive
CREATE TABLE sales_archive AS
SELECT * FROM sales
WHERE created_at < NOW() - INTERVAL '2 years';

DELETE FROM sales
WHERE created_at < NOW() - INTERVAL '2 years';

-- Crear view unificada
CREATE VIEW sales_all AS
SELECT * FROM sales
UNION ALL
SELECT * FROM sales_archive;
```

#### 3. Vacuum y Analyze

```sql
-- Ejecutar mensualmente
VACUUM ANALYZE sales;
VACUUM ANALYZE products;
VACUUM ANALYZE employees;

-- Configurar autovacuum
ALTER TABLE sales SET (autovacuum_vacuum_scale_factor = 0.1);
```

---

### Infraestructura (Supabase)

#### 1. Configuración Recomendada

```yaml
# Supabase Dashboard → Settings → Database

# Pool Size
max_connections: 100 (plan Pro)
pool_size: 15 (por conexión)

# Timeouts
statement_timeout: 30s (queries lentas)
idle_in_transaction_session_timeout: 60s

# Logs
log_min_duration_statement: 500ms

# Cache
shared_buffers: 256MB (plan Pro)
effective_cache_size: 1GB
```

#### 2. Limites de Rate Limiting

```javascript
// Implementar en frontend
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute',
});

async function apiCall() {
  await limiter.removeTokens(1);
  return supabase.from('sales').select('*');
}
```

#### 3. CDN para Assets

```javascript
// Mover imágenes de productos a CDN
const productImageUrl = `https://cdn.stockly.com/products/${productId}.jpg`;

// Antes: Supabase Storage (lento, costoso)
// Después: CloudFlare CDN (rápido, barato)
```

---

## 📊 LÍMITES REALES DEL SISTEMA

### Con Configuración Actual (Plan Gratuito Supabase)

| Recurso | Límite | Consecuencia |
|---------|--------|--------------|
| **Conexiones DB** | 60 simultáneas | Rechaza requests después de 60 |
| **Ancho de banda** | 5GB/mes | Throttling después |
| **Tamaño DB** | 500MB | No permite más INSERTs |
| **Realtime** | 200 concurrent | Desconecta clientes |

**Calculando usuarios concurrentes:**
```
60 conexiones / 3 requests promedio por usuario = 20 usuarios concurrentes
```

**Con 100 negocios:**
```
100 negocios * 20 empleados = 2000 usuarios totales
2000 / 20 concurrentes = 100 usuarios activos a la vez MAX
```

### Con Plan Pro ($25/mes)

| Recurso | Límite | Capacidad |
|---------|--------|-----------|
| **Conexiones DB** | 200 simultáneas | ~60 usuarios concurrentes |
| **Ancho de banda** | 250GB/mes | ~1M requests |
| **Tamaño DB** | 8GB | ~50M ventas |
| **Realtime** | 500 concurrent | 500 dispositivos |

### Escalabilidad Estimada

**Configuración Recomendada por Tamaño:**

| Negocios | Empleados | Ventas/mes | Plan Supabase | Costo/mes |
|----------|-----------|------------|---------------|-----------|
| 1-10 | 50 | 10K | Free | $0 |
| 10-50 | 250 | 50K | Pro | $25 |
| 50-200 | 1K | 200K | Team | $599 |
| 200+ | 5K+ | 1M+ | Enterprise | Custom |

---

## ✅ CHECKLIST DE EJECUCIÓN

### Fase 1: Preparación (1-2 horas)

- [ ] Instalar k6: `brew install k6`
- [ ] Crear usuario de prueba en Supabase
- [ ] Poblar BD con datos de test (100 negocios, 10K ventas)
- [ ] Configurar variables de entorno para tests
- [ ] Habilitar `pg_stat_statements` en Supabase

### Fase 2: Tests Básicos (2-3 horas)

- [ ] Ejecutar load test (50 VUs, 10 minutos)
- [ ] Analizar métricas de latencia
- [ ] Verificar logs de Supabase
- [ ] Identificar queries lentas (> 500ms)
- [ ] Documentar errores encontrados

### Fase 3: Tests de Estrés (2-3 horas)

- [ ] Ejecutar stress test incremental (50 → 300 VUs)
- [ ] Identificar punto de quiebre
- [ ] Monitorear conexiones de DB
- [ ] Capturar errores de timeout
- [ ] Medir tiempo de recuperación

### Fase 4: Tests de Concurrencia (1-2 horas)

- [ ] Test de race condition en stock
- [ ] Test de códigos duplicados
- [ ] Test de ventas concurrentes
- [ ] Verificar locks en BD
- [ ] Validar integridad de datos

### Fase 5: Tests de Seguridad (1 hora)

- [ ] Test de cross-tenant access
- [ ] Test de RLS bajo carga
- [ ] Test de token expiration
- [ ] Validar logs de acceso

### Fase 6: Optimizaciones (4-6 horas)

- [ ] Crear índices faltantes
- [ ] Optimizar queries N+1
- [ ] Implementar throttling en realtime
- [ ] Agregar paginación
- [ ] Fix race conditions
- [ ] Implementar idempotencia

### Fase 7: Re-test (2 horas)

- [ ] Ejecutar load test nuevamente
- [ ] Comparar métricas antes/después
- [ ] Validar mejoras
- [ ] Documentar resultados finales

### Fase 8: Documentación (1 hora)

- [ ] Crear reporte ejecutivo
- [ ] Documentar problemas encontrados
- [ ] Listar optimizaciones aplicadas
- [ ] Definir límites de producción
- [ ] Crear guía de monitoreo

---

## 📝 CONCLUSIONES

### Estado Actual
- ✅ Índices implementados correctamente
- ✅ RLS funcional y seguro
- ⚠️ Performance aceptable para < 50 usuarios concurrentes
- ❌ No escala a 100+ usuarios sin optimizaciones
- ❌ Race conditions críticas en stock
- ❌ Sin manejo de idempotencia

### Prioridades de Optimización

**Alta Prioridad (hacer YA):**
1. Fix race condition en stock (UPDATE atómico)
2. Eliminar N+1 queries (usar JOINs)
3. Implementar paginación real
4. Agregar throttling a realtime

**Media Prioridad (próximas 2 semanas):**
5. Implementar idempotencia
6. Optimizar generación de códigos
7. Agregar connection pooling
8. Implementar retry con backoff

**Baja Prioridad (futuro):**
9. Migrar a React Query
10. Agregar CDN para assets
11. Implementar archivado de datos
12. Monitoreo con Grafana

### Límites Recomendados de Producción

**Plan Gratuito:**
- Máximo 10 negocios
- Máximo 50 usuarios concurrentes
- Máximo 100 ventas/hora

**Plan Pro ($25/mes):**
- Máximo 100 negocios
- Máximo 200 usuarios concurrentes
- Máximo 1000 ventas/hora

**Monitorear:**
- Conexiones DB (alerta > 80%)
- Latencia P95 (alerta > 1000ms)
- Error rate (alerta > 2%)
- Tamaño de BD (alerta > 400MB en free tier)

---

**Siguiente paso:** Ejecutar `load-test-ventas.js` y analizar resultados reales.
