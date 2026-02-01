# 🔒 Sistema de Deshabilitación de Negocios por Falta de Pago

## 📋 Descripción

Sistema completo para bloquear el acceso a negocios que no han realizado el pago mensual de $50.000 COP.

---

## 🗄️ 1. CONFIGURACIÓN DE BASE DE DATOS

### Ejecutar la migración SQL

**Archivo:** `/supabase/migrations/add_business_active_status.sql`

**Ejecutar en Supabase:**

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a **SQL Editor**
3. Ejecuta el contenido del archivo de migración
4. Esto agregará la columna `is_active` a la tabla `businesses`

**Comandos SQL principales:**

```sql
-- Ver todos los negocios y su estado
SELECT id, name, owner_name, is_active, created_at 
FROM businesses 
ORDER BY created_at DESC;

-- Deshabilitar un negocio (cuando NO pague)
UPDATE businesses 
SET is_active = false 
WHERE id = 'uuid-del-negocio';

-- Reactivar un negocio (después del pago)
UPDATE businesses 
SET is_active = true 
WHERE id = 'uuid-del-negocio';

-- Ver negocios deshabilitados
SELECT id, name, owner_name, created_at 
FROM businesses 
WHERE is_active = false;
```

---

## 🎯 2. FLUJO DE TRABAJO

### Escenario 1: Negocio con Pago Pendiente (Advertencia)

**Configuración:** `/src/config/unpaidBusinesses.js`

```javascript
export const UNPAID_BUSINESS_IDS = [
  'ea865e94-0e46-4cb1-a9ea-6f88b0442f80',  // Ejemplo
];
```

**Comportamiento:**
- ✅ El usuario puede acceder al sistema
- ⚠️ Ve un modal de advertencia (puede cerrarlo)
- 📅 Mensaje: "El servicio puede ser deshabilitado en los próximos 3 días"
- 💳 Muestra información de pago

### Escenario 2: Negocio Deshabilitado (Bloqueado)

**SQL:**
```sql
UPDATE businesses SET is_active = false WHERE id = 'uuid-del-negocio';
```

**Comportamiento:**
- 🔒 El usuario NO puede acceder al sistema
- 🚫 Ve un modal BLOQUEANTE (no se puede cerrar)
- 💳 Debe realizar el pago para reactivar
- 📞 Solo puede cerrar sesión

---

## 📝 3. PROCESO COMPLETO DE GESTIÓN DE PAGOS

### PASO 1: Advertencia Inicial (Día 1)
```javascript
// Agregar ID a unpaidBusinesses.js
export const UNPAID_BUSINESS_IDS = [
  'abc-123-def-456',
];
```
- El negocio ve advertencia al iniciar sesión
- Puede continuar usando el sistema
- Tiene 3 días para pagar

### PASO 2: Bloqueo (Día 4 - Si no paga)
```sql
UPDATE businesses 
SET is_active = false 
WHERE id = 'abc-123-def-456';
```
- El negocio queda bloqueado
- No puede acceder al sistema
- Ve modal con información de pago

### PASO 3: Reactivación (Después del pago)
```sql
-- 1. Reactivar el negocio
UPDATE businesses 
SET is_active = true 
WHERE id = 'abc-123-def-456';

-- 2. Quitar de la lista de advertencia
-- Editar unpaidBusinesses.js y eliminar el ID
```

---

## 🛠️ 4. COMPONENTES CREADOS

### PaymentWarningModal.jsx (Advertencia)
- Modal **cerrable**
- Advertencia de 3 días
- Información de pago
- Usuario puede continuar

### BusinessDisabledModal.jsx (Bloqueo)
- Modal **NO cerrable**
- Servicio suspendido
- Información de pago destacada
- Solo botón "Cerrar Sesión"

---

## 💰 5. INFORMACIÓN DE PAGO

**Método:** Nu (Bre-B)  
**Llave:** @APM331  
**Titular:** Andres Felipe  
**Valor:** $50.000 COP  

**⚠️ IMPORTANTE:** Por favor, realice el envío a través de **Bre-B** a la llave **@APM331** y remita una fotografía del comprobante de pago por nuestro canal de WhatsApp, indicando el nombre de su negocio para poder identificarlo correctamente en nuestro sistema.

---

## 📊 6. CONSULTAS ÚTILES

### Ver estado de un negocio específico
```sql
SELECT name, is_active, created_at 
FROM businesses 
WHERE id = 'uuid-del-negocio';
```

### Listar todos los negocios deshabilitados
```sql
SELECT id, name, owner_name, created_at 
FROM businesses 
WHERE is_active = false
ORDER BY created_at DESC;
```

### Contar negocios por estado
```sql
SELECT 
  is_active,
  COUNT(*) as total
FROM businesses
GROUP BY is_active;
```

### Buscar negocio por nombre
```sql
SELECT id, name, owner_name, is_active 
FROM businesses 
WHERE name ILIKE '%nombre%';
```

---

## ✅ 7. CHECKLIST DE IMPLEMENTACIÓN

- [x] Migración SQL creada
- [x] Modal de advertencia creado
- [x] Modal de bloqueo creado
- [x] Dashboard integrado
- [x] EmployeeDashboard integrado
- [ ] **PENDIENTE:** Ejecutar migración SQL en Supabase
- [ ] **PENDIENTE:** Probar con negocio de prueba

---

## 🧪 8. CÓMO PROBAR

### Prueba 1: Modal de Advertencia
1. Agregar ID de tu negocio a `unpaidBusinesses.js`
2. Cerrar sesión
3. Iniciar sesión nuevamente
4. Verificar que aparece modal de advertencia (cerrable)

### Prueba 2: Modal de Bloqueo
1. Ejecutar SQL:
   ```sql
   UPDATE businesses 
   SET is_active = false 
   WHERE id = 'tu-negocio-id';
   ```
2. Cerrar sesión
3. Iniciar sesión nuevamente
4. Verificar que aparece modal bloqueante
5. Verificar que NO se puede cerrar
6. Solo funciona "Cerrar Sesión"

### Prueba 3: Reactivación
1. Ejecutar SQL:
   ```sql
   UPDATE businesses 
   SET is_active = true 
   WHERE id = 'tu-negocio-id';
   ```
2. Iniciar sesión
3. Verificar acceso normal al sistema

---

## 🔐 9. SEGURIDAD

- ✅ La columna `is_active` está en base de datos (no se puede manipular desde frontend)
- ✅ Verificación en ambos dashboards (dueño y empleados)
- ✅ Modal bloqueante no se puede cerrar
- ✅ Verificación temprana en el flujo de autenticación

---

## 📞 10. SOPORTE

Si un cliente reporta bloqueo incorrecto:

1. Verificar estado en BD:
   ```sql
   SELECT name, is_active FROM businesses WHERE id = 'uuid';
   ```

2. Verificar pago recibido

3. Reactivar si corresponde:
   ```sql
   UPDATE businesses SET is_active = true WHERE id = 'uuid';
   ```

---

## 🎯 11. MEJORAS FUTURAS SUGERIDAS

- [ ] Sistema automático de verificación de pagos
- [ ] Tabla de historial de pagos
- [ ] Notificaciones automáticas por email
- [ ] Dashboard de administración de pagos
- [ ] Reportes de pagos mensuales
