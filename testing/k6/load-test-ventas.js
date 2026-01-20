/**
 * 🔥 K6 LOAD TEST - VENTAS MODULE
 * 
 * Simula carga normal de usuarios consultando y creando ventas
 * Escenario: 50 usuarios concurrentes durante 15 minutos
 * 
 * Ejecutar:
 * k6 run --env API_URL=https://xxx.supabase.co \
 *        --env SUPABASE_ANON_KEY=xxx \
 *        --env BUSINESS_ID=xxx \
 *        testing/k6/load-test-ventas.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// =====================================================
// MÉTRICAS PERSONALIZADAS
// =====================================================

const failureRate = new Rate('failed_requests');
const latencyTrend = new Trend('request_latency_ms');
const dbErrors = new Counter('database_errors');
const rlsErrors = new Counter('rls_policy_errors');
const timeoutErrors = new Counter('timeout_errors');

// =====================================================
// CONFIGURACIÓN DE LA PRUEBA
// =====================================================

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Calentamiento: 0 → 10 usuarios
    { duration: '3m', target: 50 },   // Rampa: 10 → 50 usuarios
    { duration: '10m', target: 50 },  // Carga sostenida: 50 usuarios
    { duration: '2m', target: 20 },   // Descenso gradual
    { duration: '1m', target: 0 },    // Cool down
  ],
  
  thresholds: {
    // Latencia
    'http_req_duration': [
      'p(50)<300',   // 50% de requests < 300ms
      'p(95)<800',   // 95% de requests < 800ms
      'p(99)<1500',  // 99% de requests < 1.5s
    ],
    
    // Errores HTTP
    'http_req_failed': ['rate<0.02'], // < 2% de errores HTTP
    
    // Errores de lógica de negocio
    'failed_requests': ['rate<0.05'], // < 5% de fallos lógicos
    
    // Throughput mínimo
    'http_reqs': ['rate>40'], // > 40 requests/segundo
    
    // Métricas personalizadas
    'database_errors': ['count<10'],    // Máximo 10 errores de BD
    'rls_policy_errors': ['count<5'],   // Máximo 5 errores de RLS
    'timeout_errors': ['count<3'],      // Máximo 3 timeouts
  },
  
  // Opciones de ejecución
  noConnectionReuse: false,
  userAgent: 'K6LoadTest/1.0 (Stocky Performance Testing)',
  throw: true,
};

// =====================================================
// SETUP: AUTENTICACIÓN Y DATOS DE PRUEBA
// =====================================================

export function setup() {
  const API_URL = __ENV.API_URL;
  const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
  
  if (!API_URL || !ANON_KEY) {
    throw new Error('❌ Faltan variables de entorno. Usa --env API_URL=... --env SUPABASE_ANON_KEY=...');
  }
  
  console.log('🔐 Autenticando usuario de prueba...');
  
  // Login con usuario de prueba
  const loginRes = http.post(
    `${API_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: 'test@stockly.com',
      password: 'test1234',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    }
  );
  
  if (loginRes.status !== 200) {
    console.error('❌ Login falló:', loginRes.body);
    throw new Error('No se pudo autenticar. Crea usuario test@stockly.com');
  }
  
  const authData = loginRes.json();
  const token = authData.access_token;
  const userId = authData.user.id;
  
  console.log('✅ Autenticado:', userId);
  
  // Obtener lista de productos para simular ventas
  const productsRes = http.get(
    `${API_URL}/rest/v1/products?business_id=eq.${__ENV.BUSINESS_ID}&select=id,name,price&limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY,
      },
    }
  );
  
  const products = productsRes.json();
  console.log(`📦 Cargados ${products.length} productos para simular ventas`);
  
  return {
    apiUrl: API_URL,
    anonKey: ANON_KEY,
    token: token,
    userId: userId,
    businessId: __ENV.BUSINESS_ID,
    products: products || [],
  };
}

// =====================================================
// FUNCIONES HELPER
// =====================================================

function getHeaders(data) {
  return {
    'Authorization': `Bearer ${data.token}`,
    'apikey': data.anonKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

function checkResponse(response, name, expectedStatus = 200) {
  const success = response.status === expectedStatus;
  
  // Registrar latencia
  latencyTrend.add(response.timings.duration);
  
  // Registrar fallos
  failureRate.add(!success);
  
  // Detectar tipos de errores
  if (!success) {
    const body = response.body || '';
    
    if (body.includes('permission denied') || body.includes('RLS')) {
      rlsErrors.add(1);
      console.error(`🔒 Error RLS en ${name}:`, body.substring(0, 100));
    } else if (body.includes('timeout') || response.timings.duration > 10000) {
      timeoutErrors.add(1);
      console.error(`⏱️ Timeout en ${name}`);
    } else {
      dbErrors.add(1);
      console.error(`💾 Error DB en ${name}:`, body.substring(0, 100));
    }
  }
  
  return check(response, {
    [`${name}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name}: latencia < 1000ms`]: (r) => r.timings.duration < 1000,
  });
}

// =====================================================
// ESCENARIOS DE PRUEBA
// =====================================================

export default function (data) {
  const headers = getHeaders(data);
  
  // Distribuir carga: 60% lecturas, 30% escrituras, 10% reportes
  const random = Math.random();
  
  if (random < 0.60) {
    // ESCENARIO 1: Consultar ventas (operación más frecuente)
    testListSales(data, headers);
  } else if (random < 0.90) {
    // ESCENARIO 2: Crear venta (operación crítica)
    testCreateSale(data, headers);
  } else {
    // ESCENARIO 3: Generar reporte (operación pesada)
    testSalesReport(data, headers);
  }
  
  // Pausa realista entre acciones
  sleep(randomIntBetween(1, 3));
}

// =====================================================
// TEST 1: LISTAR VENTAS
// =====================================================

function testListSales(data, headers) {
  group('Listar Ventas', () => {
    const response = http.get(
      `${data.apiUrl}/rest/v1/sales?business_id=eq.${data.businessId}&select=*,seller_name&order=created_at.desc&limit=50`,
      { headers }
    );
    
    const success = checkResponse(response, 'GET /sales', 200);
    
    if (success) {
      const sales = response.json();
      check(sales, {
        'Tiene datos de ventas': (s) => Array.isArray(s) && s.length > 0,
        'Ventas del negocio correcto': (s) => s.every(sale => sale.business_id === data.businessId),
      });
    }
  });
}

// =====================================================
// TEST 2: CREAR VENTA
// =====================================================

function testCreateSale(data, headers) {
  group('Crear Venta', () => {
    // Generar datos de venta realistas
    const numItems = randomIntBetween(1, 5);
    const selectedProducts = [];
    let total = 0;
    
    for (let i = 0; i < numItems; i++) {
      const product = randomItem(data.products);
      const quantity = randomIntBetween(1, 10);
      const price = parseFloat(product.price) || 10000;
      
      selectedProducts.push({
        product_id: product.id,
        quantity: quantity,
        unit_price: price,
        subtotal: quantity * price,
      });
      
      total += quantity * price;
    }
    
    // Paso 1: Crear venta principal
    const saleData = {
      business_id: data.businessId,
      user_id: data.userId,
      seller_name: 'Test Usuario K6',
      total: total,
      payment_method: randomItem(['cash', 'card', 'transfer']),
    };
    
    const saleResponse = http.post(
      `${data.apiUrl}/rest/v1/sales`,
      JSON.stringify(saleData),
      { headers }
    );
    
    const saleSuccess = checkResponse(saleResponse, 'POST /sales', 201);
    
    if (!saleSuccess) {
      console.error('❌ Fallo al crear venta:', saleResponse.body);
      return;
    }
    
    const sale = saleResponse.json();
    
    check(sale, {
      'Venta tiene ID': (s) => !!s.id,
      'Total correcto': (s) => s.total === total,
    });
    
    // Paso 2: Crear detalles de venta
    const details = selectedProducts.map(item => ({
      ...item,
      sale_id: sale.id,
    }));
    
    const detailsResponse = http.post(
      `${data.apiUrl}/rest/v1/sale_details`,
      JSON.stringify(details),
      { headers }
    );
    
    checkResponse(detailsResponse, 'POST /sale_details', 201);
    
    // Paso 3: Verificar que la venta aparece en la lista
    sleep(0.5);
    
    const verifyResponse = http.get(
      `${data.apiUrl}/rest/v1/sales?id=eq.${sale.id}`,
      { headers }
    );
    
    if (checkResponse(verifyResponse, 'GET /sales/:id', 200)) {
      const verified = verifyResponse.json();
      check(verified, {
        'Venta encontrada': (v) => v.length === 1,
      });
    }
  });
}

// =====================================================
// TEST 3: REPORTE DE VENTAS
// =====================================================

function testSalesReport(data, headers) {
  group('Reporte de Ventas', () => {
    // Obtener ventas con JOIN a detalles (query pesada)
    const response = http.get(
      `${data.apiUrl}/rest/v1/sales?business_id=eq.${data.businessId}&select=*,sale_details(*,product:products(name,category))&limit=20`,
      { headers }
    );
    
    const success = checkResponse(response, 'GET /sales (con JOIN)', 200);
    
    if (success) {
      const sales = response.json();
      check(sales, {
        'Reporte tiene datos': (s) => s.length > 0,
        'Incluye detalles': (s) => s.some(sale => sale.sale_details && sale.sale_details.length > 0),
      });
    }
    
    // Calcular totales (simular procesamiento cliente)
    sleep(0.3);
  });
}

// =====================================================
// TEARDOWN: LIMPIEZA
// =====================================================

export function teardown(data) {
  console.log('🧹 Limpiando datos de prueba...');
  
  // Opcional: Eliminar ventas de prueba creadas
  // (solo si quieres limpiar después)
  
  console.log('✅ Prueba completada');
}

// =====================================================
// ANÁLISIS DE RESULTADOS
// =====================================================

export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count;
  const failedRequests = data.metrics.http_req_failed.values.passes;
  const avgLatency = data.metrics.http_req_duration.values.avg;
  const p95Latency = data.metrics.http_req_duration.values['p(95)'];
  const p99Latency = data.metrics.http_req_duration.values['p(99)'];
  
  const summary = {
    '📊 RESUMEN DE PRUEBA': {
      'Total de requests': totalRequests,
      'Requests fallidos': failedRequests,
      'Tasa de error': `${(failedRequests / totalRequests * 100).toFixed(2)}%`,
      'Latencia promedio': `${avgLatency.toFixed(2)}ms`,
      'Latencia P95': `${p95Latency.toFixed(2)}ms`,
      'Latencia P99': `${p99Latency.toFixed(2)}ms`,
      'Throughput': `${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`,
    },
    '🔍 ANÁLISIS': {
      'Errores de base de datos': data.metrics.database_errors ? data.metrics.database_errors.values.count : 0,
      'Errores de RLS': data.metrics.rls_policy_errors ? data.metrics.rls_policy_errors.values.count : 0,
      'Timeouts': data.metrics.timeout_errors ? data.metrics.timeout_errors.values.count : 0,
    },
    '✅ UMBRALES': {
      'P95 < 800ms': p95Latency < 800 ? '✓ PASS' : '✗ FAIL',
      'Errores < 2%': (failedRequests / totalRequests) < 0.02 ? '✓ PASS' : '✗ FAIL',
      'Throughput > 40': data.metrics.http_reqs.values.rate > 40 ? '✓ PASS' : '✗ FAIL',
    }
  };
  
  console.log('\n' + JSON.stringify(summary, null, 2));
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'testing/results/load-test-ventas.json': JSON.stringify(data, null, 2),
  };
}
