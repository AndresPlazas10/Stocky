/**
 * 🔥 K6 CONCURRENCY TEST - RACE CONDITIONS
 * 
 * Simula múltiples usuarios modificando el mismo recurso simultáneamente
 * Detecta: race conditions, duplicados, locks, deadlocks
 * 
 * Ejecutar:
 * k6 run --vus 50 --duration 30s \
 *        --env API_URL=https://xxx.supabase.co \
 *        --env SUPABASE_ANON_KEY=xxx \
 *        --env BUSINESS_ID=xxx \
 *        --env PRODUCT_ID=xxx \
 *        testing/k6/concurrency-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// =====================================================
// MÉTRICAS DE CONCURRENCIA
// =====================================================

const raceConditions = new Counter('race_conditions_detected');
const duplicates = new Counter('duplicate_records');
const locks = new Counter('lock_timeouts');
const stockInconsistencies = new Counter('stock_inconsistencies');
const finalStock = new Gauge('final_stock_value');

// =====================================================
// CONFIGURACIÓN
// =====================================================

export const options = {
  scenarios: {
    // Test 1: Actualización concurrente de stock
    stock_race_condition: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      tags: { test: 'stock' },
      exec: 'testStockRaceCondition',
    },
    
    // Test 2: Creación concurrente de códigos
    code_generation_race: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 100,
      tags: { test: 'codes' },
      exec: 'testCodeGenerationRace',
      startTime: '35s', // Empieza después del test 1
    },
    
    // Test 3: Idempotencia (doble submit)
    idempotency_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      tags: { test: 'idempotency' },
      exec: 'testIdempotency',
      startTime: '70s',
    },
  },
  
  thresholds: {
    'race_conditions_detected': ['count<5'],      // < 5 race conditions
    'duplicate_records': ['count<3'],             // < 3 duplicados
    'stock_inconsistencies': ['count<2'],         // < 2 inconsistencias
    'http_req_failed{test:stock}': ['rate<0.10'], // < 10% errores
  },
};

// =====================================================
// SETUP
// =====================================================

export function setup() {
  const API_URL = __ENV.API_URL;
  const ANON_KEY = __ENV.SUPABASE_ANON_KEY;
  const PRODUCT_ID = __ENV.PRODUCT_ID;
  
  console.log('🔬 CONCURRENCY TEST - Preparando...');
  
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
  const token = authData.access_token;
  
  // Obtener stock inicial del producto de prueba
  const productRes = http.get(
    `${API_URL}/rest/v1/products?id=eq.${PRODUCT_ID}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY,
      },
    }
  );
  
  const products = productRes.json();
  const initialStock = products.length > 0 ? products[0].stock : 100;
  
  console.log(`📦 Stock inicial del producto: ${initialStock}`);
  
  return {
    apiUrl: API_URL,
    anonKey: ANON_KEY,
    token: token,
    userId: authData.user.id,
    businessId: __ENV.BUSINESS_ID,
    productId: PRODUCT_ID,
    initialStock: initialStock,
  };
}

// =====================================================
// TEST 1: RACE CONDITION EN STOCK
// =====================================================

export function testStockRaceCondition(data) {
  group('Stock Race Condition', () => {
    const headers = {
      'Authorization': `Bearer ${data.token}`,
      'apikey': data.anonKey,
      'Content-Type': 'application/json',
    };
    
    // VULNERABLE: Read → Modify → Write
    
    // 1. Leer stock actual
    const readRes = http.get(
      `${data.apiUrl}/rest/v1/products?id=eq.${data.productId}&select=stock`,
      { headers }
    );
    
    if (readRes.status !== 200) {
      console.error('❌ Error leyendo stock:', readRes.body);
      return;
    }
    
    const product = readRes.json()[0];
    const currentStock = parseFloat(product.stock);
    
    // Simular procesamiento (aumenta probabilidad de race condition)
    sleep(0.05);
    
    // 2. Calcular nuevo stock
    const newStock = currentStock - 1;
    
    // 3. Actualizar
    const updateRes = http.patch(
      `${data.apiUrl}/rest/v1/products?id=eq.${data.productId}`,
      JSON.stringify({ stock: newStock }),
      { headers }
    );
    
    const success = check(updateRes, {
      'Stock actualizado': (r) => r.status === 200 || r.status === 204,
    });
    
    if (!success) {
      locks.add(1);
    }
  });
  
  sleep(0.1);
}

// =====================================================
// TEST 2: CÓDIGOS DUPLICADOS
// =====================================================

export function testCodeGenerationRace(data) {
  group('Code Generation Race', () => {
    const headers = {
      'Authorization': `Bearer ${data.token}`,
      'apikey': data.anonKey,
      'Content-Type': 'application/json',
    };
    
    // VULNERABLE: SELECT MAX → INSERT
    
    // 1. Obtener todos los códigos PRD-####
    const codesRes = http.get(
      `${data.apiUrl}/rest/v1/products?business_id=eq.${data.businessId}&select=code&code=ilike.PRD-%`,
      { headers }
    );
    
    const products = codesRes.json();
    
    // 2. Calcular siguiente código (RACE CONDITION AQUÍ)
    let maxNumber = 0;
    products.forEach(p => {
      const num = parseInt(p.code.split('-')[1]);
      if (num > maxNumber) maxNumber = num;
    });
    
    const newCode = `PRD-${String(maxNumber + 1).padStart(4, '0')}`;
    
    sleep(0.02); // Aumenta probabilidad de colisión
    
    // 3. Insertar producto con nuevo código
    const productData = {
      business_id: data.businessId,
      name: `Producto Test ${newCode}`,
      code: newCode,
      price: 10000,
      stock: 100,
      category: 'test',
    };
    
    const insertRes = http.post(
      `${data.apiUrl}/rest/v1/products`,
      JSON.stringify(productData),
      { headers }
    );
    
    const success = check(insertRes, {
      'Producto creado': (r) => r.status === 201,
    });
    
    if (!success) {
      const body = insertRes.body || '';
      
      // Detectar violación de UNIQUE constraint
      if (body.includes('duplicate key') || body.includes('unique constraint')) {
        duplicates.add(1);
        raceConditions.add(1);
        console.warn(`⚠️ Código duplicado detectado: ${newCode}`);
      }
    }
  });
}

// =====================================================
// TEST 3: IDEMPOTENCIA (DOBLE SUBMIT)
// =====================================================

export function testIdempotency(data) {
  group('Idempotency Test', () => {
    const headers = {
      'Authorization': `Bearer ${data.token}`,
      'apikey': data.anonKey,
      'Content-Type': 'application/json',
    };
    
    const saleData = {
      business_id: data.businessId,
      user_id: data.userId,
      seller_name: `Idempotency Test ${__VU}`,
      total: 15000,
      payment_method: 'cash',
    };
    
    // Simular doble-click: enviar 2 requests idénticas
    const [response1, response2] = http.batch([
      {
        method: 'POST',
        url: `${data.apiUrl}/rest/v1/sales`,
        body: JSON.stringify(saleData),
        params: { headers },
      },
      {
        method: 'POST',
        url: `${data.apiUrl}/rest/v1/sales`,
        body: JSON.stringify(saleData),
        params: { headers },
      },
    ]);
    
    // Ambas deberían tener éxito (201)
    const bothSuccess = response1.status === 201 && response2.status === 201;
    
    if (bothSuccess) {
      const sale1 = response1.json();
      const sale2 = response2.json();
      
      // IDs deberían ser DIFERENTES (duplicado)
      if (sale1.id !== sale2.id) {
        duplicates.add(1);
        console.error(`❌ Venta duplicada: ${sale1.id} !== ${sale2.id}`);
      }
    }
    
    check({ response1, response2 }, {
      'Primera request exitosa': () => response1.status === 201,
      'Segunda request exitosa': () => response2.status === 201,
      'NO hay duplicados': () => {
        if (response1.status === 201 && response2.status === 201) {
          return response1.json().id === response2.json().id;
        }
        return true;
      },
    });
  });
  
  sleep(1);
}

// =====================================================
// TEARDOWN: VERIFICACIÓN FINAL
// =====================================================

export function teardown(data) {
  console.log('🔍 Verificando consistencia final...');
  
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'apikey': data.anonKey,
  };
  
  // Verificar stock final del producto
  const finalRes = http.get(
    `${data.apiUrl}/rest/v1/products?id=eq.${data.productId}&select=stock`,
    { headers }
  );
  
  if (finalRes.status === 200) {
    const product = finalRes.json()[0];
    const finalStockValue = parseFloat(product.stock);
    
    finalStock.add(finalStockValue);
    
    console.log(`📊 Stock inicial: ${data.initialStock}`);
    console.log(`📊 Stock final: ${finalStockValue}`);
    
    // En test de 50 VUs * 30s con sleep(0.1) = ~150 decrementos esperados
    const expectedDecrements = 150;
    const expectedFinalStock = data.initialStock - expectedDecrements;
    const difference = Math.abs(finalStockValue - expectedFinalStock);
    
    if (difference > 10) {
      console.error(`❌ INCONSISTENCIA DE STOCK detectada!`);
      console.error(`   Esperado: ~${expectedFinalStock}`);
      console.error(`   Real: ${finalStockValue}`);
      console.error(`   Diferencia: ${difference}`);
      stockInconsistencies.add(1);
    } else {
      console.log(`✅ Stock consistente (diferencia: ${difference})`);
    }
  }
  
  // Contar productos duplicados con código PRD-####
  const codesRes = http.get(
    `${data.apiUrl}/rest/v1/products?business_id=eq.${data.businessId}&select=code&code=ilike.PRD-%`,
    { headers }
  );
  
  if (codesRes.status === 200) {
    const products = codesRes.json();
    const codes = products.map(p => p.code);
    const uniqueCodes = new Set(codes);
    
    const duplicateCount = codes.length - uniqueCodes.size;
    
    if (duplicateCount > 0) {
      console.error(`❌ ${duplicateCount} códigos duplicados encontrados`);
    } else {
      console.log(`✅ No hay códigos duplicados`);
    }
  }
}

// =====================================================
// ANÁLISIS DE RESULTADOS
// =====================================================

export function handleSummary(data) {
  const summary = {
    '🔬 CONCURRENCY TEST RESULTADOS': {
      'Race conditions detectadas': data.metrics.race_conditions_detected.values.count,
      'Registros duplicados': data.metrics.duplicate_records.values.count,
      'Locks/timeouts': data.metrics.locks.values.count,
      'Inconsistencias de stock': data.metrics.stock_inconsistencies.values.count,
    },
    '📊 STOCK FINAL': {
      'Valor final': data.metrics.final_stock_value ? data.metrics.final_stock_value.values.value : 'N/A',
    },
    '✅ VEREDICTO': {
      'Sistema seguro concurrentemente': (
        data.metrics.race_conditions_detected.values.count === 0 &&
        data.metrics.duplicate_records.values.count === 0 &&
        data.metrics.stock_inconsistencies.values.count === 0
      ) ? '✅ SÍ' : '❌ NO - Requiere fixes',
      'Idempotencia implementada': data.metrics.duplicate_records.values.count === 0 ? '✅ SÍ' : '❌ NO',
      'Stock consistency': data.metrics.stock_inconsistencies.values.count === 0 ? '✅ SÍ' : '❌ NO',
    }
  };
  
  console.log('\n' + JSON.stringify(summary, null, 2));
  
  return {
    'stdout': JSON.stringify(summary, null, 2),
    'testing/results/concurrency-test.json': JSON.stringify(data, null, 2),
  };
}
