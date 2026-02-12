# Auditoría técnica exhaustiva – Stocky POS

**Enfoque:** Errores lógicos, rendimiento, seguridad, arquitectura, base de datos, UX.  
**Criterio de gravedad:** Crítico / Alto / Medio / Bajo.  
**Sin teoría:** solo ubicación, código, motivo y dirección de mejora.

---

## 1. ERRORES LÓGICOS

### 1.1 Stock no se descuenta al cerrar orden desde Mesas (pago único y dividido)

**Ubicación:** `src/components/Dashboard/Mesas.jsx`  
- `processSplitPaymentAndClose` (aprox. líneas 791–912): inserta en `sales` y `sale_details`, cierra orden y mesa; **no llama a ninguna RPC de reducción de stock**.  
- `processPaymentAndClose` (aprox. líneas 914–1070): mismo flujo; **tampoco actualiza stock**.

**Por qué es problema:** Las ventas quedan registradas pero el inventario no se descuenta. El módulo Ventas (salesService) sí usa `update_stock_batch`; Mesas es una vía alternativa de venta que deja el stock desincronizado.

**Gravedad:** Crítico.

**Mejora sugerida:** Tras insertar `sale_details` en ambos flujos, llamar a `supabase.rpc('update_stock_batch', { product_updates: [...] })` con los ítems vendidos (product_id, quantity). Si la RPC falla, hacer rollback de la venta y detalles antes de cerrar la orden.

---

### 1.2 Posible inconsistencia de columna en registro de negocio

**Ubicación:** `src/pages/Register.jsx`  
- Línea 80: ` .eq('cleanUsername', cleanUsername)` sobre `businesses`.  
- Líneas 127–134: insert en `businesses` con `username: cleanUsername` (y `created_by`, etc.).

**Por qué es problema:** Si la tabla solo tiene `username` y no `cleanUsername`, el `select` no filtra por el mismo campo que se usa para unicidad en la UI, y podrían existir duplicados o errores silenciosos. Si solo existe `cleanUsername`, el insert fallaría o insertaría en otra columna según el schema real.

**Gravedad:** Alto (si el schema no tiene ambas columnas o no están sincronizadas).

**Mejora sugerida:** Revisar el schema de `businesses` (columnas `username` y `cleanUsername`). Unificar criterio: una sola columna para “username normalizado” y usarla tanto en el `select` de existencia como en el `insert`. Añadir constraint UNIQUE en esa columna si no existe.

---

### 1.3 Login: signOut en cada montaje de la página

**Ubicación:** `src/pages/Login.jsx` líneas 21–25.

```javascript
useEffect(() => {
  const initAuth = async () => {
    await supabase.auth.signOut();
  };
  initAuth();
}, []);
```

**Por qué es problema:** Cada vez que el usuario entra a `/login` (por ejemplo desde “Cerrar sesión” o al recargar) se fuerza signOut. Si la intención es solo “mostrar login cuando no hay sesión”, no es necesario cerrar sesión; si el usuario tenía sesión y abrió Login por error, pierde la sesión sin aviso.

**Gravedad:** Medio.

**Mejora sugerida:** Eliminar el `signOut()` automático. Dejar que la lógica de rutas protegidas redirija a `/login` cuando no haya sesión. Si se desea “Cerrar sesión” explícito, hacerlo con un botón que llame a `signOut` y luego redirija a `/login`.

---

### 1.4 Facturas: reducción de stock en loop (N+1) y sin rollback atómico

**Ubicación:** `src/components/Dashboard/Facturas.jsx` aprox. líneas 337–348.

```javascript
for (const item of items) {
  const { error: stockError } = await supabase.rpc('reduce_stock', {
    p_product_id: item.product_id,
    p_quantity: item.quantity
  });
  if (stockError) stockErrors.push(...);
}
```

**Por qué es problema:** Una factura con N ítems hace N llamadas a `reduce_stock`. Si una falla a mitad del loop, los productos anteriores ya tienen stock reducido y la factura ya está creada; no hay rollback unificado de factura + items + stock.

**Gravedad:** Alto.

**Mejora sugerida:** Usar una sola RPC batch (por ejemplo `update_stock_batch` con lista de `{ product_id, quantity }`) después de crear factura e items. En caso de error de la RPC, eliminar la factura y sus items (rollback) y no aplicar reducción de stock. Idealmente mover toda la operación (factura + items + stock) a una transacción o función SQL única (SECURITY DEFINER) para atomicidad.

---

### 1.5 Ventas desde Mesas: created_at enviado desde cliente

**Ubicación:** `src/components/Dashboard/Mesas.jsx`  
- `processSplitPaymentAndClose`: insert en `sales` con `created_at: new Date().toISOString()`.  
- `processPaymentAndClose`: no se ve `created_at` en el fragmento leído; si también se envía desde cliente, mismo riesgo.

**Por qué es problema:** La hora del servidor (BD) puede diferir de la del cliente. Para reportes y auditoría es preferible una única fuente de verdad (servidor). No es un bug funcional grave pero sí una decisión inconsistente con el resto del sistema.

**Gravedad:** Bajo.

**Mejora sugerida:** No enviar `created_at` en el insert; dejar que la tabla use `DEFAULT now()` o equivalente en PostgreSQL.

---

## 2. RENDIMIENTO

### 2.1 getSales: múltiples consultas secuenciales

**Ubicación:** `src/services/salesService.js` función `getSales` (aprox. 36–106).

**Fragmento:** Se hace: 1) `getCurrentUser()`, 2) `sales` con `eq('business_id')`, 3) `businesses` por id, 4) `employees` por business_id, luego enriquecimiento en memoria.

**Por qué es problema:** Hasta 4 round-trips a la BD por una sola “pantalla de ventas”. En conexiones lentas o muchos usuarios, la carga inicial de Ventas se resiente.

**Gravedad:** Medio.

**Mejora sugerida:** Si la API lo permite, usar un solo `select` con joins (por ejemplo ventas + datos de negocio/empleado) o una RPC que devuelva ventas enriquecidas. Reducir a 1–2 consultas.

---

### 2.2 getFilteredSales y getFilteredPurchases: enriquecimiento en dos pasos

**Ubicación:**  
- `src/services/salesService.js` `getFilteredSales`: tras paginar ventas, se hace otra query a `employees` y otra a `businesses`, luego map en memoria.  
- `src/services/purchasesService.js` `getFilteredPurchases`: solo devuelve datos crudos; si el consumidor luego pide empleados/suppliers por separado, se repite el patrón N+1 o múltiples queries.

**Por qué es problema:** Más round-trips y trabajo en cliente del que sería necesario para una sola vista paginada.

**Gravedad:** Medio.

**Mejora sugerida:** Mover el enriquecimiento a una vista SQL o a una RPC que devuelva la página ya enriquecida. Evitar una query de ventas y luego N+1 o 2 queries adicionales por página.

---

### 2.3 loadMesas: select anidado pesado

**Ubicación:** `src/components/Dashboard/Mesas.jsx` `loadMesas` (aprox. 105–135).

**Fragmento:**  
` .select(\`*, orders!current_order_id ( id, status, total, opened_at, order_items ( id, quantity, price, subtotal, products (name, category) ) )\`) `

**Por qué es problema:** Para muchas mesas con órdenes grandes, el payload puede ser grande y el join costoso. Además, si solo se necesita listar mesas y un resumen (total, cantidad de ítems), traer todos los `order_items` y productos es excesivo.

**Gravedad:** Medio.

**Mejora sugerida:** Para la lista de mesas, usar un select más ligero (por ejemplo solo `tables.*` y `orders.id, orders.total, orders.status`). Cargar el detalle de ítems solo al abrir una mesa (lazy load).

---

### 2.4 Facturas: reduce_stock en loop

**Ubicación:** Ya citada en 1.4.  
**Impacto:** N llamadas a `reduce_stock` por factura → latencia y carga en BD.

**Gravedad:** Alto (lógico + rendimiento).

**Mejora:** Igual que en 1.4: una RPC batch y, si es posible, transacción única en BD.

---

### 2.5 Límites fijos sin paginación

**Ubicación:**  
- `salesService.getSales`: `.limit(50)`.  
- `loadProductos` (Mesas): `.limit(200)`.

**Por qué es problema:** En negocios con muchas ventas o productos, 50/200 pueden ser insuficientes o excesivos. No hay paginación real en la UI para esas listas.

**Gravedad:** Medio.

**Mejora sugerida:** Introducir paginación (offset/limit o cursor) en la API y en la UI, y/o virtualización para listas largas.

---

## 3. SEGURIDAD

### 3.1 Cliente Supabase: solo anon key en frontend

**Ubicación:** `src/supabase/Client.jsx`.  
Se usa `VITE_SUPABASE_ANON_KEY` y opciones de auth (PKCE, persistSession, etc.).

**Por qué es problema:** La anon key es pública por naturaleza. Todo el control de acceso debe depender de RLS y de no exponer operaciones sensibles vía anon. Si en algún momento se usara service_role o una key con más privilegios en el cliente, sería crítico.

**Gravedad:** Bajo (si RLS está bien aplicado en todas las tablas).

**Mejora sugerida:** Revisar que todas las tablas sensibles tengan RLS y políticas que restrinjan por `auth.uid()` y/o `business_id`. No introducir service_role ni keys privilegiadas en el bundle del frontend.

---

### 3.2 Validación de inputs en frontend solamente

**Ubicación:** Ejemplos: `Register.jsx` (username, nombre, contraseña), `Login.jsx` (username/password), formularios de productos/ventas en Dashboard.

**Por qué es problema:** Un cliente manipulado puede enviar datos inválidos (longitud, caracteres, negativos, etc.). Sin validación o sanitización en backend (funciones RPC, triggers o capa API), la BD puede almacenar datos incorrectos o romper restricciones.

**Gravedad:** Alto si no hay checks en BD; medio si hay constraints y triggers.

**Mejora sugerida:** Mantener validación en frontend para UX, y añadir en backend: tipos y checks en funciones RPC (p. ej. longitud de username, cantidad > 0, precios >= 0). En inserts/updates desde cliente, no confiar en que los valores cumplan rangos; revalidar en la función o con CHECK constraints.

---

### 3.3 Exposición de mensajes de error de BD al usuario

**Ubicación:** Varios sitios, por ejemplo `Mesas.jsx`: `throw new Error(\`Error al crear venta (${sub.name}): ${saleError.message}\`);` y luego `setError(...)` en UI.

**Por qué es problema:** `saleError.message` puede incluir detalles internos de PostgreSQL (nombres de tablas, constraints, etc.), útiles para un atacante y poco útiles para el usuario final.

**Gravedad:** Medio.

**Mejora sugerida:** En el cliente, capturar el error de Supabase y mostrar un mensaje genérico al usuario (“No se pudo registrar la venta. Intenta de nuevo.”). Registrar el mensaje completo solo en logs (servidor o herramienta de monitoreo), no en UI ni en respuestas de API públicas.

---

### 3.4 Eliminación de usuario Auth vía RPC

**Ubicación:** `src/components/Dashboard/Empleados.jsx` aprox. 289: `supabase.rpc('delete_auth_user', { user_id_to_delete: empleado.user_id })`.

**Por qué es problema:** Si la RPC no comprueba que quien llama es admin del negocio al que pertenece el empleado, un usuario autenticado podría intentar borrar otros usuarios. Depende de cómo esté implementada `delete_auth_user` (roles, comprobación de business_id, etc.).

**Gravedad:** Alto si la RPC no valida autorización; bajo si está bien restringida.

**Mejora sugerida:** Revisar la definición de `delete_auth_user`: que verifique que `auth.uid()` corresponde a un admin/owner del mismo `business_id` que el empleado, o que la RPC sea solo invocable por un rol de servicio controlado y no por anon/authenticated sin esa verificación.

---

## 4. ARQUITECTURA

### 4.1 Mesas.jsx: componente monolítico

**Ubicación:** `src/components/Dashboard/Mesas.jsx` (más de 2000 líneas).

**Por qué es problema:** Concentra estado, llamadas a API, lógica de negocio (cierre de orden, split, pago único) y UI. Dificulta pruebas unitarias, reutilización y mantenimiento. Cualquier cambio en flujo o reglas requiere tocar un archivo muy grande.

**Gravedad:** Alto.

**Mejora sugerida:** Extraer: 1) hooks (p. ej. `useMesas`, `useOrderItems`, `useCloseOrder`) que encapsulen estado y llamadas a Supabase; 2) servicios o funciones puras para “calcular totales”, “validar cierre”, “armar payload de venta”; 3) componentes presentacionales (lista de mesas, detalle de orden, modales). El componente de página solo orquesta hooks y componentes.

---

### 4.2 Lógica de ventas duplicada (Mesas vs salesService)

**Ubicación:**  
- Creación de venta en `Mesas.jsx` (`processPaymentAndClose`, `processSplitPaymentAndClose`): insert directo a `sales` y `sale_details`.  
- `salesService.createSale`: misma idea pero con `update_stock_batch`.

**Por qué es problema:** Dos implementaciones distintas del mismo concepto “registrar venta + detalles”. Mesas no actualiza stock; Ventas sí. Aumenta riesgo de bugs y de que futuros cambios (por ejemplo impuestos, descuentos) se apliquen solo en un flujo.

**Gravedad:** Alto.

**Mejora sugerida:** Unificar en un único “caso de uso” (p. ej. en salesService o en una RPC): “crear venta con ítems y actualizar stock”. Mesas y cualquier otro flujo (POS, facturas si aplica) deben llamar a ese mismo flujo. Así el descuento de stock y las reglas de negocio viven en un solo lugar.

---

### 4.3 Dashboard.jsx: carga de negocio y rutas en un solo componente

**Ubicación:** `src/pages/Dashboard.jsx`.  
Incluye `checkAuthAndLoadBusiness`, manejo de `business`, `activeSection`, y renderizado condicional de todas las secciones (Home, Ventas, Compras, etc.).

**Por qué es problema:** Mezcla autenticación, obtención de negocio, estado de UI y enrutamiento interno en un solo componente. Difícil de testear y de reutilizar (p. ej. si mañana hay otra “vista principal” con otras secciones).

**Gravedad:** Medio.

**Mejora sugerida:** Extraer un hook `useDashboardBusiness()` que devuelva `{ business, loading, error }` y opcionalmente redirija a login. Usar rutas hijas (React Router) para cada sección en lugar de un estado `activeSection` y condicionales. Dejar Dashboard como layout que usa el hook y renderiza `<Outlet />`.

---

### 4.4 Falta de capa de servicios en Mesas

**Ubicación:** `Mesas.jsx` llama directamente a `supabase` desde el componente (loadMesas, loadProductos, processSplitPaymentAndClose, etc.).

**Por qué es problema:** La lógica de acceso a datos y de negocio está acoplada al componente. No hay un lugar único donde mockear o cambiar la fuente de datos para tests o futuras migraciones.

**Gravedad:** Medio.

**Mejora sugerida:** Crear un `mesasService.js` (o `ordersService.js`) con funciones como `fetchMesas(businessId)`, `closeOrderAsSplit(businessId, payload)`, `closeOrderSingle(...)`, que internamente llamen a Supabase y opcionalmente a `update_stock_batch`. Mesas solo llama al servicio y actualiza estado/UI.

---

## 5. BASE DE DATOS

### 5.1 Posible incoherencia username / cleanUsername en businesses

**Ubicación:** Ya citada en 1.2 (Register.jsx).  
Depende del schema real de `businesses`.

**Por qué es problema:** Si el SELECT usa `cleanUsername` y el INSERT usa `username`, o si solo existe una de las dos columnas, se generan errores o datos inconsistentes.

**Gravedad:** Alto si hay discrepancia; bajo si ambas columnas existen y se usan correctamente.

**Mejora sugerida:** Revisar `information_schema.columns` para `businesses`. Definir una única noción de “username normalizado” y un único nombre de columna; usar esa columna en todas las queries y en UNIQUE si aplica.

---

### 5.2 Funciones SECURITY DEFINER y search_path

**Ubicación:** Migraciones como `20260119_fix_security_warnings.sql` y `20260119_fix_stock_update_performance.sql`.  
Se definen funciones con `SECURITY DEFINER` y en migraciones recientes se fija `SET search_path = public`.

**Por qué es problema:** Sin `search_path` fijo, un atacante con capacidad de crear objetos en otro schema podría influir en la resolución de nombres y desviar la función. Ya se ha corregido en varias funciones; puede quedar alguna sin fijar.

**Gravedad:** Medio (mitigado donde ya se aplicó).

**Mejora sugerida:** Revisar todas las funciones `SECURITY DEFINER` del proyecto (incluidas las de empleados, stock, facturación) y asegurar `SET search_path = public` (o el schema adecuado). Mantener esta práctica en nuevas funciones.

---

### 5.3 Índices y consultas frecuentes

**Ubicación:** Consultas como `sales` por `business_id` + `created_at`, `order_items` por `order_id`, `products` por `business_id` + `is_active`.

**Por qué es problema:** Si no existen índices adecuados, listados y filtros se degradan con el volumen de datos.

**Gravedad:** Medio.

**Mejora sugerida:** Revisar migraciones existentes (p. ej. `create_performance_indexes`) y asegurar índices compuestos para: `(business_id, created_at)` en sales/purchases, `(order_id)` en order_items, `(business_id, is_active)` en products. Usar EXPLAIN en las queries más usadas para confirmar uso de índices.

---

## 6. EXPERIENCIA DE USUARIO (FRONTEND)

### 6.1 Redirección con window.location.href tras login

**Ubicación:** `src/pages/Login.jsx` aprox. 74–77: tras login exitoso se hace `window.location.href = '/dashboard'` o `'/employee-dashboard'`.

**Por qué es problema:** Provoca recarga completa de la aplicación. Se pierde estado del SPA y la transición es más lenta que un `navigate()` de React Router.

**Gravedad:** Bajo.

**Mejora sugerida:** Usar `useNavigate()` de React Router y `navigate('/dashboard')` (o `/employee-dashboard`) en lugar de asignar `window.location.href`. Mantener el flujo dentro del SPA.

---

### 6.2 Errores silenciosos en loadMesas y loadProductos

**Ubicación:** `src/components/Dashboard/Mesas.jsx` en `loadMesas` y `loadProductos`: en el `catch` no se llama a `setError` ni se muestra feedback; solo `return` o comentario “Error silencioso”.

**Por qué es problema:** Si la red o Supabase fallan, el usuario ve listas vacías o desactualizadas sin saber que hubo un error. Dificulta diagnóstico y da sensación de “no pasa nada”.

**Gravedad:** Medio.

**Mejora sugerida:** En el catch, llamar a `setError('No se pudo cargar las mesas. Revisa tu conexión.')` (o mensaje similar) y opcionalmente un reintento o botón “Reintentar”. No tragar el error sin feedback.

---

### 6.3 Estados de carga y doble envío en formularios

**Ubicación:** Varios formularios (Register, Login, Empleados, etc.) usan `isSubmitting` o `loading` para deshabilitar el botón. En Mesas, `isClosingOrder` evita doble clic en “Confirmar”.

**Por qué es problema:** Si en algún flujo no se deshabilita el botón o no se usa un flag durante la petición async, el usuario puede enviar dos veces y generar ventas duplicadas o errores.

**Gravedad:** Medio (parcialmente mitigado donde ya existe el flag).

**Mejora sugerida:** Revisar todos los handlers de submit que hacen `await` y asegurar: 1) `setLoading(true)` al inicio, 2) `setLoading(false)` en `finally`, 3) botón deshabilitado cuando `loading` es true. Considerar un hook `useIdempotentSubmit` (ya existe en el proyecto) en los flujos críticos (ventas, cierre de orden).

---

## Resumen de gravedad

| Área           | Crítico | Alto | Medio | Bajo |
|----------------|---------|------|-------|------|
| Lógica         | 1       | 3    | 2     | 1    |
| Rendimiento    | 0       | 1    | 4     | 0    |
| Seguridad      | 0       | 2    | 2     | 1    |
| Arquitectura   | 0       | 2    | 2     | 0    |
| Base de datos  | 0       | 1    | 2     | 0    |
| UX             | 0       | 0    | 2     | 1    |

**Prioridad recomendada:**  
1) Corregir descuento de stock en cierre de orden desde Mesas (lógico + consistencia con Ventas).  
2) Unificar creación de venta (Mesas + salesService) y uso de `update_stock_batch`.  
3) Validar schema y uso de username/cleanUsername en Register y businesses.  
4) Revisar RPC `delete_auth_user` y políticas RLS.  
5) Reducir N+1 en Facturas (stock) y mejorar manejo de errores y feedback en Mesas/Dashboard.
