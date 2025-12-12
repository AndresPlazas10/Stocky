# 🔧 PLAN DE CORRECCIÓN COMPLETO
## Priorización y Roadmap de Implementación

---

## 🚨 FASE 1: CORRECCIONES CRÍTICAS (INMEDIATO - 1-2 días)

### 1.1 HABILITAR RLS EN PRODUCCIÓN ⚠️ SEGURIDAD

**Prioridad**: 🔴 **CRÍTICA**

**Script a ejecutar**:
```bash
# En Supabase SQL Editor
docs/sql/fix_rls_definitivo.sql
```

**Verificación**:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('businesses', 'employees', 'sales', 'products');
-- Todos deben mostrar rowsecurity = true
```

---

### 1.2 LIMPIAR BASE DE DATOS

**Prioridad**: 🔴 **CRÍTICA**

**Ejecutar**:
```bash
docs/sql/fix_sales_400_error.sql
```

**Acciones**:
- ✅ Eliminar columna `customer_id` de `sales`
- ✅ Eliminar FK rota a `customers`
- ✅ Limpiar ventas de prueba con `user_id=null`

---

### 1.3 REFACTORIZAR DASHBOARD.JSX - ELIMINAR RACE CONDITION

**Archivo**: `src/pages/Dashboard.jsx`

**Código actual problemático**:
```javascript
// ❌ PROBLEMA
function Dashboard() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Componentes se renderizan ANTES de tener business
  return (
    <DashboardLayout>
      {activeSection === 'ventas' && (
        <Ventas businessId={business?.id} /> // ❌ undefined al inicio
      )}
    </DashboardLayout>
  );
}
```

**Código corregido**:
```javascript
// ✅ SOLUCIÓN
function Dashboard() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [businessLogo, setBusinessLogo] = useState(null);

  useEffect(() => {
    checkAuthAndLoadBusiness();
  }, []);

  useEffect(() => {
    if (business?.logo_url !== undefined) {
      setBusinessLogo(business.logo_url || null);
    }
  }, [business]);

  const checkAuthAndLoadBusiness = async () => {
    try {
      setLoading(true);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        window.location.href = '/login';
        return;
      }

      setUser(user);

      // Buscar negocio
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('created_by', user.id)
        .maybeSingle();

      if (businessError) throw businessError;

      if (!business) {
        // Verificar si es empleado
        const { data: employee } = await supabase
          .from('employees')
          .select('id, business_id, role, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (employee) {
          window.location.href = '/employee-dashboard';
          return;
        }

        window.location.href = '/register';
        return;
      }

      setBusiness(business);
      setBusinessLogo(business.logo_url || null);
      
    } catch (err) {
      console.error('Error loading business:', err);
      setError('Error al cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/login';
  };

  const handleLogoChange = async (newLogoUrl) => {
    if (!business) return;

    const { error } = await supabase
      .from('businesses')
      .update({ logo_url: newLogoUrl })
      .eq('id', business.id);

    if (!error) {
      setBusiness({ ...business, logo_url: newLogoUrl });
      setBusinessLogo(newLogoUrl);
    }
  };

  // ✅ NO renderizar hasta tener datos
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-light-bg-primary to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#edb886] mx-auto mb-4"></div>
          <p className="text-secondary-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-light-bg-primary to-white">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ✅ business GARANTIZADO no-null aquí
  if (!business) {
    return null;
  }

  const renderSection = () => {
    // ✅ business.id SIEMPRE existe aquí
    const commonProps = {
      businessId: business.id,
      userRole: 'admin'
    };

    switch (activeSection) {
      case 'home':
        return <Home {...commonProps} />;
      case 'ventas':
        return <Ventas {...commonProps} />;
      case 'compras':
        return <Compras {...commonProps} />;
      case 'inventario':
        return <Inventario {...commonProps} />;
      case 'proveedores':
        return <Proveedores {...commonProps} />;
      case 'empleados':
        return <Empleados {...commonProps} />;
      case 'facturas':
        return <Facturas {...commonProps} />;
      case 'reportes':
        return <Reportes {...commonProps} />;
      case 'configuracion':
        return (
          <Configuracion
            {...commonProps}
            onLogoChange={handleLogoChange}
          />
        );
      default:
        return <Home {...commonProps} />;
    }
  };

  return (
    <DashboardLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      business={business}
      businessLogo={businessLogo}
      user={user}
      onSignOut={handleSignOut}
    >
      {renderSection()}
    </DashboardLayout>
  );
}

export default Dashboard;
```

**Cambios clave**:
1. ✅ Loading state hasta tener business
2. ✅ Error state si falla carga
3. ✅ business garantizado no-null en render
4. ✅ commonProps para evitar prop drilling
5. ✅ Switch statement para sections más limpio

---

### 1.4 ELIMINAR/ARCHIVAR CÓDIGO MUERTO

**Archivos a eliminar**:
```bash
# Componente Clientes no funciona (tabla customers eliminada)
rm src/components/Dashboard/Clientes.jsx

# Hook inútil
rm src/hooks/useCustomers.js
```

**Archivos a renombrar** (por ahora):
```bash
# Mantener como backup
mv src/components/Dashboard/Ventas.jsx src/components/Dashboard/Ventas.old.jsx
mv src/components/Dashboard/VentasNew.jsx src/components/Dashboard/Ventas.jsx
```

---

### 1.5 REMOVER LOGS DE DEBUG

**Script automatizado**:
```bash
# Crear script de limpieza
cat > scripts/remove-debug-logs.sh << 'EOF'
#!/bin/bash

# Eliminar console.log con emojis
find src -type f -name "*.jsx" -o -name "*.js" | xargs sed -i '' '/console\.log.*[✅🔍📝❌⏳]/d'

# Eliminar console.error de debugging
find src -type f -name "*.jsx" -o -name "*.js" | xargs sed -i '' '/console\.error.*Error al/d'

echo "✅ Debug logs eliminados"
EOF

chmod +x scripts/remove-debug-logs.sh
./scripts/remove-debug-logs.sh
```

**Reemplazar con logger condicional**:
```javascript
// src/utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  info: (...args) => {
    if (isDev) console.log(...args);
  },
  error: (...args) => {
    if (isDev) console.error(...args);
    // TODO: En producción, enviar a Sentry
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  }
};
```

---

## 🟡 FASE 2: OPTIMIZACIONES (3-5 días)

### 2.1 CREAR ÍNDICES EN BASE DE DATOS

```sql
-- Ejecutar en Supabase SQL Editor

-- Ventas
CREATE INDEX IF NOT EXISTS idx_sales_business_created 
  ON sales(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_user 
  ON sales(user_id) 
  WHERE user_id IS NOT NULL;

-- Productos
CREATE INDEX IF NOT EXISTS idx_products_business_active 
  ON products(business_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_code 
  ON products(code) 
  WHERE code IS NOT NULL;

-- Empleados
CREATE INDEX IF NOT EXISTS idx_employees_business_active 
  ON employees(business_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_employees_user 
  ON employees(user_id);

-- Sale Details
CREATE INDEX IF NOT EXISTS idx_sale_details_sale 
  ON sale_details(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_details_product 
  ON sale_details(product_id);

-- Purchases
CREATE INDEX IF NOT EXISTS idx_purchases_business_created 
  ON purchases(business_id, created_at DESC) 
  WHERE purchases IS NOT NULL;

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_business_created 
  ON invoices(business_id, created_at DESC);

-- Verificar tamaño de índices
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

### 2.2 OPTIMIZAR QUERIES CON JOINS

**Antes** (N+1 query):
```javascript
// Cargar ventas
const { data: sales } = await supabase
  .from('sales')
  .select('*')
  .eq('business_id', businessId);

// Cargar empleados separadamente
const { data: employees } = await supabase
  .from('employees')
  .select('*')
  .eq('business_id', businessId);

// Mapear manualmente
const employeesMap = new Map(employees.map(e => [e.user_id, e]));
```

**Después** (1 query con JOIN):
```javascript
const { data: sales } = await supabase
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

// Ya viene con employee embebido
// sales[0].employee.full_name
```

---

### 2.3 DIVIDIR COMPONENTES GRANDES

**Ventas.jsx** (1403 líneas) → Dividir en:

```
components/Dashboard/Ventas/
├── index.jsx              # Contenedor (100 líneas)
├── VentasPOS.jsx         # Sistema POS (300 líneas)
├── VentasHistorial.jsx   # Lista ventas (200 líneas)
├── VentaInvoiceModal.jsx # Modal factura (150 líneas)
├── VentaDeleteModal.jsx  # Modal eliminar (80 líneas)
├── useVentas.js          # Hook custom (150 líneas)
└── usePOS.js             # Lógica POS (120 líneas)
```

---

### 2.4 IMPLEMENTAR RETRY EN QUERIES

```javascript
// src/utils/supabaseWithRetry.js
export async function queryWithRetry(queryFn, options = {}) {
  const {
    maxRetries = 3,
    backoff = 1000,
    onRetry = () => {}
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await queryFn();
      
      // Si es error de Supabase (no de red), no reintentar
      if (result.error) {
        throw result.error;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Si es último intento, lanzar error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Callback de retry
      onRetry(attempt + 1, error);
      
      // Esperar con backoff exponencial
      await new Promise(resolve => 
        setTimeout(resolve, backoff * Math.pow(2, attempt))
      );
    }
  }
  
  throw lastError;
}

// Uso:
const { data } = await queryWithRetry(
  () => supabase.from('sales').select(),
  {
    maxRetries: 3,
    onRetry: (attempt) => console.log(`Reintento ${attempt}/3`)
  }
);
```

---

### 2.5 CREAR HOOK useAuth CENTRALIZADO

```javascript
// src/hooks/useAuth.js
import { useState, useEffect, useContext, createContext } from 'react';
import { supabase } from '@/supabase/Client';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT') {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'global' });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Usar en App.jsx**:
```javascript
import { AuthProvider } from '@/hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* rutas */}
      </Routes>
    </AuthProvider>
  );
}
```

---

## 🟢 FASE 3: MEJORAS A LARGO PLAZO (1-2 semanas)

### 3.1 MIGRAR A TYPESCRIPT

**Beneficios**:
- Type safety
- Mejor autocompletado
- Menos bugs
- Mejor refactoring

**Pasos**:
```bash
npm install -D typescript @types/react @types/react-dom

# Renombrar archivos gradualmente
mv src/pages/Dashboard.jsx src/pages/Dashboard.tsx
```

---

### 3.2 IMPLEMENTAR TESTING

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom

# Crear tests
tests/
├── components/
│   ├── Dashboard.test.tsx
│   └── Ventas.test.tsx
├── hooks/
│   └── useAuth.test.ts
└── utils/
    └── formatters.test.ts
```

---

### 3.3 IMPLEMENTAR ERROR TRACKING

```bash
npm install @sentry/react @sentry/vite-plugin
```

```javascript
// src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

### 3.4 IMPLEMENTAR CACHING

```javascript
// src/utils/cache.js
class QueryCache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const queryCache = new QueryCache(60000); // 1 min TTL
```

---

### 3.5 IMPLEMENTAR SERVICE WORKERS

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 300
              }
            }
          }
        ]
      }
    })
  ]
});
```

---

## 📊 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 (Crítico - 1-2 días)
- [ ] Ejecutar fix_rls_definitivo.sql
- [ ] Ejecutar fix_sales_400_error.sql
- [ ] Refactorizar Dashboard.jsx
- [ ] Eliminar Clientes.jsx y useCustomers.js
- [ ] Renombrar Ventas → Ventas.old, VentasNew → Ventas
- [ ] Remover console.logs de debug
- [ ] Verificar que todo funciona

### Fase 2 (Optimización - 3-5 días)
- [ ] Crear índices en BD
- [ ] Optimizar queries con JOINs
- [ ] Dividir componentes grandes
- [ ] Implementar retry en queries
- [ ] Crear useAuth hook
- [ ] Testing manual completo

### Fase 3 (Mejoras - 1-2 semanas)
- [ ] Migración a TypeScript
- [ ] Tests unitarios
- [ ] Integración con Sentry
- [ ] Implementar caching
- [ ] Service Workers / PWA

---

## 🎯 MÉTRICAS DE ÉXITO

**Antes**:
- ❌ Errores 400/404 en consola
- ❌ RLS deshabilitado
- ❌ Queries N+1
- ❌ Código duplicado
- ❌ Sin manejo de errores

**Después**:
- ✅ Sin errores en consola
- ✅ RLS habilitado y funcionando
- ✅ Queries optimizadas
- ✅ Código limpio y mantenible
- ✅ Manejo robusto de errores
- ✅ Performance mejorado 50%+
