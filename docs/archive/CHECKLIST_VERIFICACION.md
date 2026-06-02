# ✅ Checklist de Verificación - Sincronización en Tiempo Real

## 📋 Pre-requisitos

Antes de comenzar, asegúrate de tener:

- [ ] Acceso al proyecto de Supabase
- [ ] Permisos de administrador en la base de datos
- [ ] Al menos 2 cuentas de usuario del mismo negocio para probar

---

## 🔧 Paso 1: Verificar Código Frontend

### Archivo: `src/components/Dashboard/Mesas.jsx`

Busca estas líneas (alrededor de la línea 250):

```javascript
// 🔥 TIEMPO REAL: Suscripción a cambios en items de orden (NIVEL NEGOCIO)
const handleOrderItemChange = useCallback(async (item, eventType) => {
```

Y más abajo:

```javascript
useRealtimeSubscription('order_items', {
  enabled: !!businessId,
  filter: {}, // RLS se encarga del filtrado por business_id
```

**✅ Si ves estas líneas, el código está correcto**

---

## 💾 Paso 2: Aplicar Políticas RLS

### 2.1 Copiar el Script SQL

- [ ] Abre el archivo: `docs/sql/add_realtime_policies.sql`
- [ ] Copia **TODO** el contenido (Cmd/Ctrl + A, Cmd/Ctrl + C)

### 2.2 Ejecutar en Supabase

1. [ ] Ve a https://app.supabase.com
2. [ ] Selecciona tu proyecto
3. [ ] Click en **SQL Editor** (menú izquierdo)
4. [ ] Click en **New query** (botón superior derecho)
5. [ ] Pega el SQL copiado
6. [ ] Click en **Run** o presiona `Cmd/Ctrl + Enter`

### 2.3 Verificar Resultados

Deberías ver **3 tablas de resultados** al final:

#### Tabla 1: Estado RLS
```
┌──────────────┬────────────────┐
│ Tabla        │ Estado RLS     │
├──────────────┼────────────────┤
│ order_items  │ ✅ HABILITADO  │
│ sale_details │ ✅ HABILITADO  │
└──────────────┴────────────────┘
```

#### Tabla 2: Políticas
```
┌──────────────┬────────────────────────────────────────────┬───────────┐
│ Tabla        │ Política                                   │ Operación │
├──────────────┼────────────────────────────────────────────┼───────────┤
│ order_items  │ Enable all for business members via orders │ ALL       │
│ sale_details │ Enable all for business members via sales  │ ALL       │
└──────────────┴────────────────────────────────────────────┴───────────┘
```

#### Tabla 3: Permisos
```
┌──────────────┬─────────────────────────────────────────┐
│ Tabla        │ Permisos                                │
├──────────────┼─────────────────────────────────────────┤
│ order_items  │ SELECT, INSERT, UPDATE, DELETE          │
│ sale_details │ SELECT, INSERT, UPDATE, DELETE          │
└──────────────┴─────────────────────────────────────────┘
```

**✅ Si ves estos resultados, las políticas están correctamente aplicadas**

---

## 🔌 Paso 3: Habilitar Realtime

### 3.1 Ir a Configuración de Replicación

1. [ ] En Supabase Dashboard, click en **Database** (menú izquierdo)
2. [ ] Click en **Replication** (sub-menú)

### 3.2 Activar Realtime para las Tablas

Busca estas tablas y **activa el toggle**:

- [ ] ✅ `order_items` - Toggle **ON** (verde)
- [ ] ✅ `sale_details` - Toggle **ON** (verde)

También verifica que estas estén habilitadas (si no lo están, actívalas):

- [ ] ✅ `orders` - Toggle **ON**
- [ ] ✅ `tables` - Toggle **ON**
- [ ] ✅ `products` - Toggle **ON**

**⚠️ IMPORTANTE**: Después de activar, espera ~30 segundos para que Supabase sincronice los cambios.

---

## 🧪 Paso 4: Probar la Sincronización

### Test 1: Agregar Producto

1. [ ] **Navegador 1**: Inicia sesión (Usuario A)
2. [ ] **Navegador 2**: Inicia sesión (Usuario B del mismo negocio)
3. [ ] **Ambos**: Ve a la sección **Mesas**
4. [ ] **Navegador 1**: Haz click en una mesa disponible
5. [ ] **Navegador 1**: Busca y agrega un producto
6. [ ] **Navegador 2**: **¿Se ve el cambio inmediatamente?**
   - [ ] ✅ La mesa cambia de "Disponible" a "Ocupada"
   - [ ] ✅ Se muestra el total actualizado
   - [ ] ✅ Se muestra "1 producto" (o la cantidad correcta)

### Test 2: Modificar Cantidad

1. [ ] **Navegador 1**: Abre la misma mesa
2. [ ] **Navegador 1**: Aumenta la cantidad de un producto (click en +)
3. [ ] **Navegador 2**: **¿Se actualiza el total?**
   - [ ] ✅ El total cambia instantáneamente
   - [ ] ✅ El contador de productos se actualiza

### Test 3: Eliminar Producto

1. [ ] **Navegador 1**: Elimina un producto de la orden
2. [ ] **Navegador 2**: **¿Desaparece el producto?**
   - [ ] ✅ El total se reduce
   - [ ] ✅ El contador de productos disminuye

### Test 4: Cerrar Orden

1. [ ] **Navegador 1**: Cierra la orden completamente
2. [ ] **Navegador 2**: **¿Se libera la mesa?**
   - [ ] ✅ La mesa vuelve a "Disponible"
   - [ ] ✅ El total desaparece

### Test 5: Crear Nueva Mesa

1. [ ] **Navegador 1**: Crea una nueva mesa (ej: Mesa #99)
2. [ ] **Navegador 2**: **¿Aparece la nueva mesa?**
   - [ ] ✅ Mesa #99 visible sin refrescar

---

## 🐛 Troubleshooting

### ❌ Los cambios no se sincronizan

**Verifica en Navegador 2 (Consola F12):**

```javascript
// Busca errores relacionados con Realtime
// Ejemplos de mensajes BUENOS:
"Realtime channel connected: realtime:order_items:..."
"SUBSCRIBED"

// Ejemplos de mensajes MALOS:
"Error: 42501" // Problema de permisos
"CHANNEL_ERROR" // Problema de conexión
```

**Soluciones:**

1. [ ] Verifica que las políticas RLS estén aplicadas (repite Paso 2.3)
2. [ ] Verifica que Realtime esté habilitado (repite Paso 3)
3. [ ] Refresca ambas páginas (Cmd/Ctrl + Shift + R)
4. [ ] Cierra sesión y vuelve a iniciar

### ❌ Error: "permission denied for table order_items"

**Causa**: Permisos no aplicados correctamente

**Solución**:

```sql
-- Ejecuta este SQL en Supabase SQL Editor:
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sale_details TO authenticated;
```

### ❌ Los cambios se ven, pero con retraso (>5 segundos)

**Posibles causas**:

- [ ] Conexión a internet lenta
- [ ] Plan de Supabase gratuito con límite de conexiones Realtime
- [ ] Muchas tablas con Realtime habilitado (desactiva las que no uses)

**Solución**: Verifica el plan de Supabase en Settings → Billing

---

## 🎯 Criterios de Éxito

La implementación es **EXITOSA** si:

- [x] ✅ Las 3 tablas de verificación SQL muestran datos correctos
- [x] ✅ Los 5 tests de sincronización pasan
- [x] ✅ No hay errores en la consola del navegador
- [x] ✅ Los cambios se ven en **menos de 2 segundos**

---

## 📊 Métricas de Rendimiento Esperadas

| Métrica                    | Valor Esperado  | Cómo Medirlo                                    |
|----------------------------|----------------|-------------------------------------------------|
| Latencia de sincronización | < 2 segundos   | Tiempo entre acción y actualización en otro nav |
| Errores en consola         | 0              | F12 → Console (sin errores de Realtime)        |
| Políticas RLS              | 2              | SQL: `SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('order_items', 'sale_details')` |
| Canales Realtime activos   | 3-5            | F12 → Network → WS (conexiones WebSocket)      |

---

## ✅ Confirmación Final

Cuando hayas completado TODO lo anterior:

- [ ] ✅ Código frontend actualizado
- [ ] ✅ SQL ejecutado sin errores
- [ ] ✅ Realtime habilitado en tablas
- [ ] ✅ Tests 1-5 completados exitosamente
- [ ] ✅ Sin errores en consola
- [ ] ✅ Latencia < 2 segundos

**🎉 ¡Implementación completada con éxito!**

---

## 📞 Soporte

Si algo no funciona:

1. Revisa la sección **Troubleshooting** arriba
2. Lee `docs/INSTRUCCIONES_APLICAR_FIX.md` (guía detallada)
3. Verifica los logs de Supabase: Dashboard → Logs → Realtime

---

**Última actualización**: 28 de noviembre de 2025  
**Versión**: 1.0  
**Estado**: ✅ Listo para producción
