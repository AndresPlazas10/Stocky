# 🔐 AUDITORÍA DE SEGURIDAD Y ARQUITECTURA
## Análisis Completo de Riesgos y Vulnerabilidades

---

## 🚨 VULNERABILIDADES CRÍTICAS DE SEGURIDAD

### 1. RLS DESHABILITADO EN PRODUCCIÓN

**Severidad**: 🔴 **CRÍTICA**

**Estado Actual**:
```sql
-- TABLAS SIN PROTECCIÓN RLS:
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
```

**Vectores de Ataque**:
```javascript
// ❌ ATAQUE 1: Usuario malicioso puede ver TODOS los negocios
const { data: allBusinesses } = await supabase
  .from('businesses')
  .select('*');
// Devuelve TODOS los registros de TODOS los negocios

// ❌ ATAQUE 2: Empleado de negocio A puede ver ventas de negocio B
const { data: competitorSales } = await supabase
  .from('sales')
  .select('*')
  .eq('business_id', 'competitor-business-id');
// Devuelve ventas del competidor

// ❌ ATAQUE 3: Modificar datos de otros negocios
await supabase
  .from('products')
  .update({ price: 0 })
  .eq('business_id', 'victim-business-id');
// Destruye precios del competidor
```

**Impacto Real**:
- ✅ Fuga de información comercial sensible
- ✅ Acceso a datos de facturación de competidores
- ✅ Manipulación de inventarios ajenos
- ✅ Robo de información de clientes/proveedores
- ✅ Violación de GDPR/LOPD
- ✅ Responsabilidad legal

**Solución Inmediata**:
```sql
-- EJECUTAR INMEDIATAMENTE: docs/sql/fix_rls_definitivo.sql

-- Habilitar RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can only access their own business"
  ON businesses FOR ALL
  USING (created_by = auth.uid());

CREATE POLICY "Users can only access data from their business"
  ON sales FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE created_by = auth.uid()
      UNION
      SELECT business_id FROM employees WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

---

### 2. EXPOSICIÓN DE INFORMACIÓN EN CONSOLE.LOG

**Severidad**: 🟡 **MODERADA**

**Código Actual**:
```javascript
// Dashboard.jsx
console.log('✅ Usuario autenticado:', user.email);
console.log('🔍 Buscando negocio para usuario:', user.id);
console.log('📊 Business encontrado:', business);

// Ventas.jsx
console.log('📝 Datos de venta a insertar:', saleData);
// Expone: business_id, user_id, totales, métodos de pago

// Facturas.jsx
console.error('❌ Error al cargar facturas:', error);
// Puede exponer estructura de BD
```

**Riesgos**:
- Exposición de UUIDs de usuarios
- Exposición de business_ids
- Información de facturación visible
- Estructura de base de datos deducible
- Posibles tokens/keys en errores

**Solución**:
```javascript
// src/utils/logger.js
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

export const logger = {
  info: (...args) => {
    if (isDev) console.log(...args);
  },
  error: (message, error) => {
    if (isDev) {
      console.error(message, error);
    }
    if (isProd) {
      // Enviar a Sentry SIN datos sensibles
      Sentry.captureException(error, {
        tags: { component: 'Dashboard' },
        // NO incluir user.email, business_id, etc.
      });
    }
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  }
};

// Reemplazar todos los console.log por logger
logger.info('Usuario autenticado'); // Sin mostrar email
```

---

### 3. FALTA DE VALIDACIÓN DE BUSINESS_ID

**Severidad**: 🟡 **MODERADA**

**Código Vulnerable**:
```javascript
// Ventas.jsx
function Ventas({ businessId }) {
  // ❌ No valida que el usuario tenga acceso a este businessId
  useEffect(() => {
    if (businessId) {
      loadVentas(); // Carga ventas sin verificar permisos
    }
  }, [businessId]);
  
  const loadVentas = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId); // ❌ Confía en el prop
  };
}
```

**Ataque Posible**:
```javascript
// Usuario malicioso modifica React DevTools
// Cambia businessId prop a UUID de otro negocio
<Ventas businessId="uuid-de-otro-negocio" />
// Ve ventas de otro negocio
```

**Solución**:
```javascript
// useBusinessAccess.js
export function useBusinessAccess(businessId) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Verificar que el usuario es dueño o empleado
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .eq('created_by', user.id)
        .maybeSingle();

      if (business) {
        setHasAccess(true);
      } else {
        // Verificar si es empleado
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('business_id', businessId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        setHasAccess(!!employee);
      }

      setLoading(false);
    }

    verifyAccess();
  }, [businessId]);

  return { hasAccess, loading };
}

// Usar en componentes
function Ventas({ businessId }) {
  const { hasAccess, loading } = useBusinessAccess(businessId);

  if (loading) return <Loading />;
  if (!hasAccess) return <Unauthorized />;

  // Ahora sí cargar datos
  // ...
}
```

---

### 4. FALTA DE RATE LIMITING

**Severidad**: 🟡 **MODERADA**

**Problema**:
```javascript
// Usuario malicioso puede hacer 1000s de queries
for (let i = 0; i < 10000; i++) {
  await supabase.from('sales').select();
}
// Sin límite de requests
```

**Solución**:
```sql
-- En Supabase: Settings > API > Rate Limiting
-- Configurar:
-- - 100 requests/segundo por IP
-- - 1000 requests/hora por usuario autenticado
```

```javascript
// Frontend: Implementar debounce en búsquedas
import { debounce } from 'lodash';

const searchProducts = debounce(async (query) => {
  const { data } = await supabase
    .from('products')
    .select()
    .ilike('name', `%${query}%`);
}, 300); // 300ms debounce
```

---

### 5. FALTA DE SANITIZACIÓN EN BÚSQUEDAS

**Severidad**: 🟢 **LEVE** (PostgREST ya previene SQL injection)

**Código Actual**:
```javascript
// Búsqueda de productos
const searchTerm = userInput; // Sin sanitización
const { data } = await supabase
  .from('products')
  .select()
  .ilike('name', `%${searchTerm}%`); // ⚠️ Potencial problema
```

**Mejora**:
```javascript
// Sanitizar input
const sanitizeSearch = (input) => {
  return input
    .trim()
    .replace(/[%_]/g, '\\$&') // Escapar wildcards
    .substring(0, 100); // Limitar longitud
};

const searchTerm = sanitizeSearch(userInput);
```

---

## 🏗️ PROBLEMAS DE ARQUITECTURA

### 6. LÓGICA DE NEGOCIO EN FRONTEND

**Problema**:
```javascript
// Ventas.jsx - Lógica compleja en React
const processSale = async () => {
  // 1. Insertar venta
  const { data: sale } = await supabase.from('sales').insert([saleData]);
  
  // 2. Insertar detalles (loop)
  for (const item of cartItems) {
    await supabase.from('sale_details').insert([{
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price
    }]);
    
    // 3. Actualizar stock (uno por uno)
    await supabase.from('products').update({
      current_stock: item.current_stock - item.quantity
    }).eq('id', item.id);
  }
  
  // ❌ PROBLEMAS:
  // - 1 + N + N queries (si hay 10 items = 21 queries)
  // - No transaccional (puede fallar a mitad)
  // - Lento (latencia multiplicada)
  // - Race conditions (dos ventas simultáneas)
};
```

**Solución**: Usar PostgreSQL Functions

```sql
-- Crear función transaccional
CREATE OR REPLACE FUNCTION process_sale(
  p_business_id UUID,
  p_user_id UUID,
  p_seller_name TEXT,
  p_payment_method TEXT,
  p_total NUMERIC,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
BEGIN
  -- 1. Insertar venta
  INSERT INTO sales (business_id, user_id, seller_name, payment_method, total)
  VALUES (p_business_id, p_user_id, p_seller_name, p_payment_method, p_total)
  RETURNING id INTO v_sale_id;
  
  -- 2. Insertar detalles y actualizar stock (batch)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insertar detalle
    INSERT INTO sale_details (sale_id, product_id, quantity, price, subtotal)
    VALUES (
      v_sale_id,
      (v_item.value->>'product_id')::UUID,
      (v_item.value->>'quantity')::INTEGER,
      (v_item.value->>'price')::NUMERIC,
      (v_item.value->>'subtotal')::NUMERIC
    );
    
    -- Actualizar stock (atómico)
    UPDATE products
    SET current_stock = current_stock - (v_item.value->>'quantity')::INTEGER
    WHERE id = (v_item.value->>'product_id')::UUID
      AND business_id = p_business_id
      AND current_stock >= (v_item.value->>'quantity')::INTEGER;
    
    -- Verificar que se actualizó (no había stock)
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %', v_item.value->>'product_id';
    END IF;
  END LOOP;
  
  RETURN v_sale_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automático
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usar en React:
const { data, error } = await supabase.rpc('process_sale', {
  p_business_id: businessId,
  p_user_id: user.id,
  p_seller_name: sellerName,
  p_payment_method: paymentMethod,
  p_total: total,
  p_items: JSON.stringify(cartItems)
});
// ✅ 1 sola query
// ✅ Transaccional
// ✅ Atómico
// ✅ 10-20x más rápido
```

---

### 7. COMPONENTES GIGANTES (1400+ LÍNEAS)

**Problema**:
```
Ventas.jsx - 1403 líneas
Mesas.jsx - 1425 líneas
Facturas.jsx - 1332 líneas
```

**Consecuencias**:
- Difícil de mantener
- Re-renders innecesarios
- Imposible de testear
- Bugs difíciles de rastrear
- Performance pobre

**Solución**: Component Splitting

```
components/Dashboard/Ventas/
├── index.jsx (100 líneas)
│   └── Container principal, routing lógico
│
├── VentasPOS/
│   ├── index.jsx (150 líneas)
│   ├── ProductSearch.jsx (80 líneas)
│   ├── Cart.jsx (120 líneas)
│   ├── PaymentModal.jsx (100 líneas)
│   └── usePOS.js (150 líneas)
│
├── VentasHistory/
│   ├── index.jsx (100 líneas)
│   ├── SalesList.jsx (80 líneas)
│   ├── SaleFilters.jsx (60 líneas)
│   └── useSalesHistory.js (100 líneas)
│
└── Shared/
    ├── InvoiceModal.jsx (150 líneas)
    ├── DeleteModal.jsx (80 líneas)
    └── useVentas.js (120 líneas)
```

---

### 8. FALTA DE GESTIÓN DE ESTADO GLOBAL

**Problema**:
```javascript
// Dashboard.jsx carga business
const [business, setBusiness] = useState(null);

// Pasa como prop a TODOS los componentes
<Ventas businessId={business?.id} />
<Compras businessId={business?.id} />
<Inventario businessId={business?.id} />
// ...y 10 componentes más

// Cada componente carga su propia data
// Sin cache compartido
// Sin sincronización
```

**Solución**: Context API o Zustand

```javascript
// src/stores/businessStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useBusinessStore = create(
  persist(
    (set, get) => ({
      business: null,
      user: null,
      loading: true,
      
      loadBusiness: async (userId) => {
        const { data } = await supabase
          .from('businesses')
          .select('*')
          .eq('created_by', userId)
          .maybeSingle();
        
        set({ business: data, loading: false });
      },
      
      updateBusiness: (updates) => {
        set({ business: { ...get().business, ...updates } });
      },
      
      clearBusiness: () => {
        set({ business: null, user: null });
      }
    }),
    {
      name: 'business-storage',
      partialize: (state) => ({ business: state.business })
    }
  )
);

// Usar en componentes
function Ventas() {
  const { business } = useBusinessStore();
  // No más props drilling
}
```

---

### 9. FALTA DE ERROR BOUNDARIES

**Problema**:
```javascript
// Si un componente explota, toda la app crashea
function Ventas() {
  // Si esto lanza error, app rompe completamente
  const data = processComplexData();
  
  return <div>{data.map(...)}</div>; // ❌ Crash
}
```

**Solución**:
```javascript
// src/components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Enviar a Sentry
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Algo salió mal</h2>
          <button onClick={() => window.location.reload()}>
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usar:
<ErrorBoundary>
  <Ventas />
</ErrorBoundary>
```

---

### 10. FALTA DE VALIDACIÓN DE PERMISOS POR ROL

**Problema**:
```javascript
// Empleados pueden acceder a TODO
// No hay diferenciación entre Admin/Cajero/Bodega

function Configuracion({ businessId }) {
  // ❌ Cualquier empleado puede cambiar configuración
  const updateBusiness = async () => {
    await supabase
      .from('businesses')
      .update({ name: newName })
      .eq('id', businessId);
  };
}
```

**Solución**:
```javascript
// src/hooks/usePermissions.js
export function usePermissions() {
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    async function loadPermissions() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Verificar si es dueño
      const { data: business } = await supabase
        .from('businesses')
        .select('created_by')
        .eq('created_by', user.id)
        .maybeSingle();
      
      if (business) {
        setRole('owner');
        setPermissions({
          canEditBusiness: true,
          canManageEmployees: true,
          canViewReports: true,
          canMakeSales: true,
          canManageInventory: true
        });
        return;
      }
      
      // Si no es dueño, cargar permisos de empleado
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (employee) {
        setRole(employee.role);
        setPermissions(ROLE_PERMISSIONS[employee.role]);
      }
    }
    
    loadPermissions();
  }, []);

  return { role, permissions };
}

const ROLE_PERMISSIONS = {
  admin: {
    canEditBusiness: true,
    canManageEmployees: true,
    canViewReports: true,
    canMakeSales: true,
    canManageInventory: true
  },
  cashier: {
    canEditBusiness: false,
    canManageEmployees: false,
    canViewReports: false,
    canMakeSales: true,
    canManageInventory: false
  },
  warehouse: {
    canEditBusiness: false,
    canManageEmployees: false,
    canViewReports: false,
    canMakeSales: false,
    canManageInventory: true
  }
};

// Usar en componentes
function Configuracion() {
  const { permissions } = usePermissions();
  
  if (!permissions.canEditBusiness) {
    return <Unauthorized />;
  }
  
  // ...
}
```

---

## 📊 ANÁLISIS DE RENDIMIENTO

### 11. QUERIES N+1

**Ubicaciones**:
```javascript
// Ventas.jsx - loadVentas()
const { data: sales } = await supabase.from('sales').select();
// Luego carga empleados separadamente
const { data: employees } = await supabase.from('employees').select();
// 1 + 1 = 2 queries

// Peor aún en sale_details:
for (const sale of sales) {
  const { data: details } = await supabase
    .from('sale_details')
    .select()
    .eq('sale_id', sale.id);
  // 1 + N queries (si hay 50 ventas = 51 queries!)
}
```

**Impacto**:
- Latencia acumulada: 50 ventas × 100ms = 5 segundos
- Ancho de banda desperdiciado
- UX pobre

**Solución**:
```javascript
// ✅ 1 query con JOIN
const { data: sales } = await supabase
  .from('sales')
  .select(`
    *,
    employee:employees!sales_user_id_fkey (
      full_name,
      role
    ),
    details:sale_details (
      id,
      product_id,
      quantity,
      price,
      subtotal,
      product:products (
        name,
        code
      )
    )
  `)
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(50);

// Ya viene todo embebido
// sales[0].employee.full_name
// sales[0].details[0].product.name
// 1 query, <200ms
```

---

### 12. FALTA DE PAGINACIÓN

**Problema**:
```javascript
// Carga TODAS las ventas de la historia
const { data } = await supabase
  .from('sales')
  .select('*')
  .eq('business_id', businessId);
// Si hay 10,000 ventas = 10,000 registros cargados
```

**Solución**:
```javascript
// Paginación con limit + offset
const PAGE_SIZE = 50;

const loadVentas = async (page = 0) => {
  const { data, count } = await supabase
    .from('sales')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  
  return { sales: data, total: count, pages: Math.ceil(count / PAGE_SIZE) };
};
```

---

### 13. REALTIME SIN FILTROS

**Problema**:
```javascript
// Ventas.jsx escucha TODOS los cambios en sales
supabase
  .channel('sales-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sales'
  }, payload => {
    // ❌ Recibe cambios de TODOS los negocios
    // Incluso sin RLS habilitado
  })
  .subscribe();
```

**Solución**:
```javascript
// Filtrar por business_id
supabase
  .channel(`sales-changes-${businessId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sales',
    filter: `business_id=eq.${businessId}` // ✅ Solo mi negocio
  }, payload => {
    // Solo cambios relevantes
  })
  .subscribe();
```

---

## 🗄️ PROBLEMAS DE BASE DE DATOS

### 14. FALTA DE ÍNDICES

**Impacto**:
```sql
-- Query sin índice hace Sequential Scan
EXPLAIN ANALYZE
SELECT * FROM sales 
WHERE business_id = '...' 
ORDER BY created_at DESC 
LIMIT 50;

-- Resultado:
-- Seq Scan on sales (cost=0.00..1234.56 rows=10000)
-- Planning Time: 2.345 ms
-- Execution Time: 450.123 ms ❌

-- Con índice:
-- Index Scan using idx_sales_business_created
-- Planning Time: 0.234 ms
-- Execution Time: 12.456 ms ✅ 37x más rápido
```

**Solución**: Ver `create_indexes_performance.sql`

---

### 15. FALTA DE FOREIGN KEY CONSTRAINTS

**Problema**:
```sql
-- No hay FK entre sale_details y products
-- Permite "ventas fantasma"
INSERT INTO sale_details (sale_id, product_id, quantity)
VALUES (uuid_generate_v4(), 'producto-inexistente', 10);
-- Se inserta sin error ❌
```

**Solución**:
```sql
-- Agregar FKs
ALTER TABLE sale_details
ADD CONSTRAINT fk_sale_details_sale
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE sale_details
ADD CONSTRAINT fk_sale_details_product
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
```

---

### 16. FALTA DE DEFAULTS Y NOT NULL

**Problema**:
```sql
-- Columnas sin default permiten NULL inesperados
CREATE TABLE sales (
  total NUMERIC, -- ❌ Puede ser NULL
  payment_method TEXT, -- ❌ Puede ser NULL
  created_at TIMESTAMPTZ -- ❌ Puede ser NULL
);
```

**Solución**:
```sql
ALTER TABLE sales
ALTER COLUMN total SET DEFAULT 0,
ALTER COLUMN total SET NOT NULL,
ALTER COLUMN payment_method SET DEFAULT 'cash',
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN created_at SET NOT NULL;
```

---

## 📝 RESUMEN DE RIESGOS

| # | Problema | Severidad | Impacto | Esfuerzo Fix | Prioridad |
|---|----------|-----------|---------|--------------|-----------|
| 1 | RLS deshabilitado | 🔴 CRÍTICA | Fuga de datos | 2h | P0 |
| 2 | Logs en producción | 🟡 MODERADA | Exposición info | 1h | P1 |
| 3 | Sin validación business_id | 🟡 MODERADA | Acceso no autorizado | 3h | P1 |
| 4 | Sin rate limiting | 🟡 MODERADA | Abuso de API | 1h | P2 |
| 5 | Sin sanitización | 🟢 LEVE | Potencial XSS | 2h | P3 |
| 6 | Lógica en frontend | 🟡 MODERADA | Performance | 8h | P1 |
| 7 | Componentes gigantes | 🟡 MODERADA | Mantenimiento | 16h | P2 |
| 8 | Sin estado global | 🟢 LEVE | Performance | 6h | P3 |
| 9 | Sin error boundaries | 🟢 LEVE | UX | 2h | P3 |
| 10 | Sin permisos por rol | 🟡 MODERADA | Seguridad | 6h | P1 |
| 11 | Queries N+1 | 🟡 MODERADA | Performance | 4h | P2 |
| 12 | Sin paginación | 🟢 LEVE | Performance | 3h | P2 |
| 13 | Realtime sin filtros | 🟢 LEVE | Performance | 1h | P3 |
| 14 | Sin índices | 🟡 MODERADA | Performance | 2h | P1 |
| 15 | Sin FKs | 🟡 MODERADA | Integridad | 3h | P2 |
| 16 | Sin defaults | 🟢 LEVE | Integridad | 2h | P3 |

**Total P0**: 1 (2h)  
**Total P1**: 5 (20h)  
**Total P2**: 5 (30h)  
**Total P3**: 5 (16h)  

**Tiempo total estimado**: 68 horas (~2 semanas)

---

## ✅ CHECKLIST DE SEGURIDAD PARA PRODUCCIÓN

```bash
# ANTES DE DEPLOY:
[ ] RLS habilitado en TODAS las tablas
[ ] Políticas RLS testeadas
[ ] Índices creados
[ ] Foreign keys verificados
[ ] Defaults configurados
[ ] Logs de debug removidos
[ ] Error tracking configurado (Sentry)
[ ] Rate limiting activado
[ ] Permisos por rol implementados
[ ] Business access validation
[ ] HTTPS enforced
[ ] Environment variables seguras
[ ] Backup automático configurado
[ ] Monitoring configurado
```
