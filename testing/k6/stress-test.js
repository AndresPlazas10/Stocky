/**
 * 🔥 K6 STRESS TEST - SISTEMA COMPLETO
 * 
 * Incrementa carga progresivamente hasta romper el sistema
 * Objetivo: Encontrar límites reales y cuellos de botella
 * 
 * Ejecutar:
 * k6 run --env API_URL=https://xxx.supabase.co \
 *        --env SUPABASE_ANON_KEY=xxx \
 *        --env BUSINESS_ID=xxx \
 *        testing/k6/stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// =====================================================
// MÉTRICAS
// =====================================================

const errorRate = new Rate('errors');
const degradationTrend = new Trend('performance_degradation');
const connectionErrors = new Counter('connection_errors');
const systemBreakpoint = new Counter('system_breakpoint_reached');

// =====================================================
// CONFIGURACIÓN STRESS TEST
// =====================================================

export const options = {
  stages: [
    // Fase 1: Baseline (sistema sano)
    { duration: '2m', target: 20 },
    
    // Fase 2: Carga normal
    { duration: '3m', target: 50 },
    
    // Fase 3: Incremento moderado
    { duration: '3m', target: 100 },
    
    // Fase 4: Estrés alto (esperamos degradación)
    { duration: '3m', target: 150 },
    
    // Fase 5: Estrés extremo (esperamos fallos)
    { duration: '3m', target: 200 },
    
    // Fase 6: Punto de quiebre (sistema debe fallar)
    { duration: '3m', target: 300 },
    
    // Fase 7: Recuperación
    { duration: '2m', target: 0 },
  ],
  
  thresholds: {
    // Más tolerantes que load test
    'http_req_duration': ['p(95)<3000'], // P95 < 3s (toleramos degradación)
    'http_req_failed': ['rate<0.30'],    // < 30% errores (aceptable en stress)
    'errors': ['rate<0.50'],             // < 50% errores totales
  },
};

// =====================================================
// SETUP
// =====================================================

export function setup() {
  const API_URL = __ENV.API_URL;
  const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
  
  console.log('🔥 STRESS TEST - Preparando...');
  
  // Autenticar
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
  
  const authData = loginRes.json();
  
  return {
    apiUrl: API_URL,
    anonKey: ANON_KEY,
    token: authData.access_token,
    userId: authData.user.id,
    businessId: __ENV.BUSINESS_ID,
  };
}

// =====================================================
// TEST PRINCIPAL
// =====================================================

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'apikey': data.anonKey,
    'Content-Type': 'application/json',
  };
  
  // Mix realista de operaciones (ponderado)
  const operation = Math.random();
  
  try {
    if (operation < 0.40) {
      // 40%: Consultas simples
      testSimpleQuery(data, headers);
    } else if (operation < 0.70) {
      // 30%: Operaciones de escritura
      testWriteOperation(data, headers);
    } else if (operation < 0.85) {
      // 15%: Queries con JOIN
      testComplexQuery(data, headers);
    } else {
      // 10%: Reportes pesados
      testHeavyReport(data, headers);
    }
  } catch (error) {
    errorRate.add(1);
    connectionErrors.add(1);
    console.error(`❌ Error en VU ${__VU}:`, error.message);
  }
  
  // Pausa más corta = más estrés
  sleep(randomIntBetween(0.3, 1));
}

// =====================================================
// OPERACIONES DE PRUEBA
// =====================================================

function testSimpleQuery(data, headers) {
  const start = Date.now();
  
  const response = http.get(
    `${data.apiUrl}/rest/v1/sales?business_id=eq.${data.businessId}&limit=10`,
    { headers, timeout: '10s' }
  );
  
  const duration = Date.now() - start;
  degradationTrend.add(duration);
  
  const success = check(response, {
    'Simple query OK': (r) => r.status === 200,
    'Latencia razonable': (r) => r.timings.duration < 2000,
  });
  
  if (!success) {
    errorRate.add(1);
    
    // Detectar punto de quiebre
    if (response.status === 0 || response.status >= 500) {
      systemBreakpoint.add(1);
      console.error(`🔴 Sistema en punto de quiebre (VUs: ${__VU})`);
    }
  }
}

function testWriteOperation(data, headers) {
  const saleData = {
    business_id: data.businessId,
    user_id: data.userId,
    seller_name: `VU${__VU}`,
    total: randomIntBetween(1000, 50000),
    payment_method: 'cash',
  };
  
  const response = http.post(
    `${data.apiUrl}/rest/v1/sales`,
    JSON.stringify(saleData),
    { headers, timeout: '10s' }
  );
  
  check(response, {
    'INSERT exitoso': (r) => r.status === 201,
  }) || errorRate.add(1);
}

function testComplexQuery(data, headers) {
  const response = http.get(
    `${data.apiUrl}/rest/v1/sales?business_id=eq.${data.businessId}&select=*,sale_details(*)&limit=5`,
    { headers, timeout: '15s' }
  );
  
  check(response, {
    'JOIN query OK': (r) => r.status === 200,
    'No timeout': (r) => r.timings.duration < 5000,
  }) || errorRate.add(1);
}

function testHeavyReport(data, headers) {
  // Query muy pesada con múltiples JOINs y aggregations
  const response = http.get(
    `${data.apiUrl}/rest/v1/sales?business_id=eq.${data.businessId}&select=*,sale_details(*,product:products(name,category))&limit=20`,
    { headers, timeout: '30s' }
  );
  
  const success = check(response, {
    'Heavy report completa': (r) => r.status === 200,
  });
  
  if (!success) {
    errorRate.add(1);
    console.warn(`⚠️ Heavy report falló (latencia: ${response.timings.duration}ms)`);
  }
}

// =====================================================
// ANÁLISIS DE RESULTADOS
// =====================================================

export function handleSummary(data) {
  const stages = [
    { name: 'Baseline (20 VUs)', start: 0, end: 120 },
    { name: 'Normal (50 VUs)', start: 120, end: 300 },
    { name: 'Moderado (100 VUs)', start: 300, end: 480 },
    { name: 'Alto (150 VUs)', start: 480, end: 660 },
    { name: 'Extremo (200 VUs)', start: 660, end: 840 },
    { name: 'Quiebre (300 VUs)', start: 840, end: 1020 },
  ];
  
  const summary = {
    '🔥 STRESS TEST RESULTADOS': {
      'Total requests': data.metrics.http_reqs.values.count,
      'Tasa de error total': `${(data.metrics.errors.values.rate * 100).toFixed(2)}%`,
      'Errores de conexión': data.metrics.connection_errors.values.count,
      'Sistema llegó a punto de quiebre': data.metrics.system_breakpoint_reached.values.count > 10 ? 'SÍ ⚠️' : 'NO ✅',
    },
    '📈 DEGRADACIÓN POR FASE': {
      'P95 latencia promedio': `${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`,
      'P99 latencia': `${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`,
      'Max latencia': `${data.metrics.http_req_duration.values.max.toFixed(2)}ms`,
    },
    '⚠️ LÍMITES DETECTADOS': {
      'VUs máximos soportados': estimateMaxVUs(data),
      'Throughput máximo': `${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`,
      'Primera degradación en': identifyDegradationPoint(data),
    }
  };
  
  console.log('\n' + JSON.stringify(summary, null, 2));
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'testing/results/stress-test.json': JSON.stringify(data, null, 2),
  };
}

function estimateMaxVUs(data) {
  // Estimar VUs máximos antes del colapso
  const errorRate = data.metrics.errors.values.rate;
  
  if (errorRate < 0.10) return '> 300 VUs (excelente)';
  if (errorRate < 0.30) return '200-300 VUs (bueno)';
  if (errorRate < 0.50) return '100-200 VUs (aceptable)';
  return '< 100 VUs (necesita optimización)';
}

function identifyDegradationPoint(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  
  if (p95 < 500) return 'Sin degradación significativa';
  if (p95 < 1000) return '~100 VUs (degradación leve)';
  if (p95 < 2000) return '~150 VUs (degradación moderada)';
  return '~50 VUs (degradación severa)';
}
