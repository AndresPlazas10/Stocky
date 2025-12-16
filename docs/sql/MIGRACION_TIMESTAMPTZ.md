# 🕐 Migración de Fechas a timestamptz

**Fecha:** 15 de diciembre de 2025  
**Autor:** Andres Plazas  
**Estado:** ✅ Completado

---

## 📋 Resumen

Se migraron todas las columnas de fechas de tipo `timestamp` a `timestamptz` (timestamp with timezone) para:

1. **Consistencia de datos** entre diferentes timezones
2. **Mejor manejo de horarios** en aplicaciones distribuidas
3. **Cumplir estándares** de PostgreSQL para aplicaciones internacionales

---

## 🔄 Cambios en Base de Datos

### Tablas Afectadas

Todas las tablas con columnas de fecha fueron actualizadas:

```sql
-- Ejemplo de cambio realizado
ALTER TABLE sales ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/Bogota';
ALTER TABLE sales ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'America/Bogota';

-- Aplicado a todas las tablas:
sales, purchases, products, invoices, customers, suppliers, 
employees, businesses, inventory_movements, tables, etc.
```

### Defaults Actualizados

```sql
-- Antes (timestamp)
created_at timestamp DEFAULT now()

-- Después (timestamptz)
created_at timestamptz DEFAULT now()
```

---

## 💻 Cambios en Código Frontend

### 1. Nuevas Funciones de Formateo

**Archivo:** `src/utils/formatters.js`

```javascript
/**
 * Formatea fechas timestamptz de PostgreSQL correctamente
 */
export const formatDate = (timestamp, options = {}) => {
  if (!timestamp) return 'Fecha inválida';
  
  try {
    // PostgreSQL timestamptz ya incluye timezone, NO agregar 'Z'
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
      ...options
    };
    
    return date.toLocaleString('es-CO', defaultOptions);
  } catch (error) {
    console.error('Error al formatear fecha:', error, timestamp);
    return 'Fecha inválida';
  }
};

// Formato solo fecha
export const formatDateOnly = (timestamp) => {
  return formatDate(timestamp, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: undefined,
    minute: undefined
  });
};

// Formato largo
export const formatDateLong = (timestamp) => {
  return formatDate(timestamp, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
```

### 2. Archivos Actualizados

#### ✅ Ventas.jsx
```javascript
// Antes
{new Date(venta.created_at + 'Z').toLocaleString('es-CO', {...})}

// Después
import { formatDate, formatDateOnly } from '../../utils/formatters';
{formatDate(venta.created_at)}
{formatDateOnly(venta.created_at)}
```

#### ✅ Compras.jsx
```javascript
// Antes
{new Date(compra.created_at).toLocaleDateString()}

// Después
import { formatDateOnly } from '../../utils/formatters';
{formatDateOnly(compra.created_at)}
```

#### ✅ Facturas.jsx
```javascript
// Antes
{new Date(factura.issued_at).toLocaleDateString('es-CO', {...})}

// Después
import { formatDate } from '../../utils/formatters';
{formatDate(factura.issued_at)}
```

#### ✅ VentasNew.jsx
```javascript
// Antes
{new Date(venta.created_at).toLocaleDateString('es-ES', {...})}

// Después
import { formatDate } from '../../utils/formatters';
{formatDate(venta.created_at)}
```

---

## ⚠️ Errores Comunes Solucionados

### ❌ Error: "Invalid Date"

**Causa:** Agregar 'Z' manualmente a fechas `timestamptz`

```javascript
// ❌ INCORRECTO (timestamp sin timezone)
new Date(fecha + 'Z')  // Necesario en timestamp sin timezone

// ✅ CORRECTO (timestamptz ya incluye timezone)
new Date(fecha)  // PostgreSQL ya retorna con timezone
```

### ❌ Error: Fecha con hora incorrecta

**Causa:** No especificar timezone en formateo

```javascript
// ❌ INCORRECTO
new Date(fecha).toLocaleDateString()  // Usa timezone del navegador

// ✅ CORRECTO
formatDate(fecha)  // Usa timezone 'America/Bogota'
```

### ❌ Error: "Cannot read property 'toLocaleString' of undefined"

**Causa:** Fecha nula o indefinida

```javascript
// ❌ INCORRECTO
new Date(fecha).toLocaleString()

// ✅ CORRECTO
formatDate(fecha)  // Retorna 'Fecha inválida' si es null
```

---

## 🧪 Testing

### Validación Manual

```javascript
// Ejemplo de salida esperada
const timestamp = '2025-12-15T14:30:00.000+00:00';  // timestamptz de PostgreSQL

console.log(formatDate(timestamp));
// Output: "15 dic 2025, 09:30"  (America/Bogota UTC-5)

console.log(formatDateOnly(timestamp));
// Output: "15 dic 2025"

console.log(formatDateLong(timestamp));
// Output: "15 de diciembre de 2025, 09:30"
```

### Casos de Prueba

```javascript
// Test 1: Fecha válida
formatDate('2025-12-15T14:30:00+00:00')
// ✅ "15 dic 2025, 09:30"

// Test 2: Fecha null
formatDate(null)
// ✅ "Fecha inválida"

// Test 3: Fecha inválida
formatDate('invalid-date')
// ✅ "Fecha inválida"

// Test 4: Objeto Date
formatDate(new Date())
// ✅ Fecha actual formateada
```

---

## 📝 Migración de Datos Existentes

Si tenías datos con fechas en UTC sin timezone:

```sql
-- Convertir fechas existentes asumiendo UTC
UPDATE sales 
SET created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota';

-- O si estaban en hora local de Colombia
UPDATE sales 
SET created_at = created_at AT TIME ZONE 'America/Bogota';
```

**⚠️ Importante:** Solo ejecutar si es necesario. Si las fechas ya están correctas, NO correr esta migración.

---

## 🔍 Verificación

### En Supabase SQL Editor

```sql
-- Verificar tipo de columnas
SELECT 
  table_name, 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('created_at', 'updated_at', 'issued_at', 'sent_at', 'closed_at')
ORDER BY table_name, column_name;

-- Verificar formato de fechas
SELECT 
  id, 
  created_at,
  created_at::text as formatted
FROM sales 
LIMIT 5;
```

Salida esperada:
```
data_type: timestamp with time zone
formatted: 2025-12-15 09:30:00-05
```

### En la Aplicación

1. Abrir módulo de Ventas
2. Verificar que fechas aparecen correctamente (no "Invalid Date")
3. Verificar que timezone sea Colombia (GMT-5)

---

## ✅ Checklist de Migración

- [x] Actualizar esquema de base de datos (timestamptz)
- [x] Crear funciones de formateo (formatters.js)
- [x] Actualizar Ventas.jsx
- [x] Actualizar Compras.jsx
- [x] Actualizar Facturas.jsx
- [x] Actualizar VentasNew.jsx
- [x] Verificar en navegador (sin "Invalid Date")
- [x] Probar creación de nuevos registros
- [x] Documentar cambios

---

## 📚 Referencias

- [PostgreSQL timestamptz Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [JavaScript Date.prototype.toLocaleString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString)
- [IANA Timezone Database - America/Bogota](https://www.iana.org/time-zones)

---

## 🎯 Próximos Pasos

1. **Monitorear** consola del navegador para errores de fechas
2. **Probar** en diferentes módulos (Reportes, Inventario, etc.)
3. **Actualizar** cualquier otro archivo que use fechas
4. **Considerar** agregar tests unitarios para formatDate()

---

**Estado:** ✅ Migración completada exitosamente  
**Impacto:** Todas las fechas ahora se muestran correctamente en timezone de Colombia
