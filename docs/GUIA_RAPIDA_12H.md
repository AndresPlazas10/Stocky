# 🎯 Guía Rápida: Formato 12 Horas en Stocky

## 📊 Tabla Comparativa de Funciones

| Función | Entrada (UTC) | Salida (12h) | Uso Recomendado |
|---------|--------------|--------------|-----------------|
| `formatDate()` | `2026-01-19T19:30:00Z` | `19 ene 2026, 02:30 PM` | Tablas, listas generales |
| `formatDateOnly()` | `2026-01-19T19:30:00Z` | `19 ene 2026` | Filtros de fecha |
| `formatTimeOnly()` | `2026-01-19T19:30:00Z` | `02:30 PM` | Mostrar solo hora |
| `formatDateLong()` | `2026-01-19T19:30:00Z` | `19 de enero de 2026, 02:30 PM` | Detalles, encabezados |
| `formatDateTimeTicket()` | `2026-01-19T19:30:00Z` | `domingo, 19 de enero de 2026 - 02:30 PM` | **Tickets POS** |
| `formatTimeCompact()` | `2026-01-19T19:30:00Z` | `2:30 PM` | UI móvil compacta |
| `formatDateTimeReport()` | `2026-01-19T19:30:00Z` | `19/01/2026 02:30 PM` | Exportaciones/reportes |

---

## 🕐 Casos Especiales: Medianoche y Mediodía

```javascript
// Medianoche (00:00 en 24h)
formatTimeOnly('2026-01-19T05:00:00Z')  // UTC 05:00 = Colombia 00:00
// ✅ Output: "12:00 AM"
// ❌ NO: "00:00" ni "24:00"

// Mediodía (12:00 en 24h)
formatTimeOnly('2026-01-19T17:00:00Z')  // UTC 17:00 = Colombia 12:00
// ✅ Output: "12:00 PM"
// ❌ NO: "12:00 M" ni "12:00"

// 1:00 AM (caso problemático común)
formatTimeOnly('2026-01-19T06:00:00Z')  // UTC 06:00 = Colombia 01:00
// ✅ Output: "01:00 AM"
// ❌ NO: "13:00 AM" (error común al convertir manualmente)

// 1:00 PM
formatTimeOnly('2026-01-19T18:00:00Z')  // UTC 18:00 = Colombia 13:00
// ✅ Output: "01:00 PM"
// ❌ NO: "13:00" ni "1:00 PM" (sin cero)
```

---

## 💻 Ejemplos de Código

### Importar Funciones

```javascript
// En componentes React
import { 
  formatDate,           // Para uso general
  formatDateOnly,       // Solo fecha
  formatTimeOnly,       // Solo hora
  formatDateLong,       // Formato largo
  formatDateTimeTicket  // Para tickets POS
} from '../../utils/formatters.js';
```

### Uso en JSX

```jsx
// Ejemplo 1: Mostrar fecha y hora en tabla
<td>{formatDate(venta.created_at)}</td>
// Output: "19 ene 2026, 02:30 PM"

// Ejemplo 2: Solo fecha
<td>{formatDateOnly(venta.created_at)}</td>
// Output: "19 ene 2026"

// Ejemplo 3: Solo hora
<span>{formatTimeOnly(venta.created_at)}</span>
// Output: "02:30 PM"

// Ejemplo 4: Formato largo para encabezados
<h3>{formatDateLong(venta.created_at)}</h3>
// Output: "19 de enero de 2026, 02:30 PM"
```

### Uso en Tickets POS

```javascript
// ANTES (código manual complejo)
const printContent = `
  <p>
    ${new Date(venta.created_at).toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}
  </p>
  <p>${new Date(venta.created_at).toLocaleTimeString('es-ES')}</p>
`;
// Output problemático: "19:30" (formato 24h)

// DESPUÉS (función centralizada)
const printContent = `
  <p>${formatDateTimeTicket(venta.created_at)}</p>
`;
// Output correcto: "domingo, 19 de enero de 2026 - 02:30 PM"
```

---

## 🔧 Configuración Técnica

### Opciones de Formato Usadas

```javascript
// Configuración aplicada en formatDate()
{
  year: 'numeric',      // 2026
  month: 'short',       // ene
  day: 'numeric',       // 19
  hour: '2-digit',      // 02 (con padding)
  minute: '2-digit',    // 30 (con padding)
  hour12: true,         // ⭐ CLAVE: Activa formato 12h
  timeZone: 'America/Bogota'  // ⭐ CLAVE: Zona horaria fija
}
```

### ¿Por qué `hour12: true`?

```javascript
// SIN hour12 (default: false en es-CO)
date.toLocaleTimeString('es-CO', {
  hour: '2-digit',
  minute: '2-digit'
});
// ❌ Output: "14:30" (formato 24 horas)

// CON hour12: true
date.toLocaleTimeString('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
});
// ✅ Output: "02:30 PM" (formato 12 horas)
```

---

## 🎨 Patrones de Uso

### ❌ NUNCA hacer esto:

```javascript
// 1. NO convertir manualmente a 12h
const hour = date.getHours();
const hour12 = hour > 12 ? hour - 12 : hour;  // BUG: medianoche = 0
const ampm = hour >= 12 ? 'PM' : 'AM';
// Propenso a errores, no usar

// 2. NO mezclar formatos
const fecha = formatDate(timestamp);        // 12h
const hora = timestamp.substr(11, 5);       // 24h (extraído como string)
// Inconsistente, confunde al usuario

// 3. NO usar toLocaleString sin opciones
date.toLocaleString();  // Usa configuración del navegador
// Resultado impredecible según usuario
```

### ✅ SIEMPRE hacer esto:

```javascript
// 1. Usar funciones centralizadas
import { formatDate, formatTimeOnly } from '../../utils/formatters.js';
const fechaHora = formatDate(timestamp);
const hora = formatTimeOnly(timestamp);

// 2. Dejar que JavaScript maneje la conversión
// Las funciones ya tienen hour12: true configurado

// 3. Validar automáticamente
// Las funciones retornan "Fecha inválida" si hay problema
const resultado = formatDate(null);  // "Sin fecha"
const resultado2 = formatDate('bad');  // "Fecha inválida"
```

---

## 🧪 Testing Rápido

Pega esto en la consola del navegador para probar:

```javascript
// Test en consola
const tests = [
  '2026-01-19T05:00:00Z',  // Medianoche Colombia
  '2026-01-19T17:00:00Z',  // Mediodía Colombia
  '2026-01-19T06:00:00Z',  // 1 AM Colombia
  '2026-01-19T18:00:00Z',  // 1 PM Colombia
  '2026-01-19T19:30:00Z',  // 2:30 PM Colombia
  '2026-01-19T13:00:00Z',  // 8:00 AM Colombia
];

// Importar (ajustar path según tu ubicación)
import { formatTimeOnly } from './src/utils/formatters.js';

// Ejecutar tests
tests.forEach(t => {
  console.log(`${t} → ${formatTimeOnly(t)}`);
});

// Salida esperada:
// 2026-01-19T05:00:00Z → 12:00 AM
// 2026-01-19T17:00:00Z → 12:00 PM
// 2026-01-19T06:00:00Z → 01:00 AM
// 2026-01-19T18:00:00Z → 01:00 PM
// 2026-01-19T19:30:00Z → 02:30 PM
// 2026-01-19T13:00:00Z → 08:00 AM
```

---

## 📝 Resumen de Cambios

### Archivos Modificados

1. **`src/utils/formatters.js`**
   - ✅ Agregado `hour12: true` a todas las funciones de tiempo
   - ✅ Nuevas funciones: `formatDateTimeTicket`, `formatTimeCompact`, `formatDateTimeReport`

2. **`src/components/Dashboard/Ventas.jsx`**
   - ✅ Línea 7: Agregado import de `formatDateTimeTicket`
   - ✅ Líneas 650-664: Ticket POS ahora usa función centralizada

3. **`src/components/Dashboard/Mesas.jsx`**
   - ✅ Línea 4: Agregado import de `formatDateTimeTicket`
   - ✅ Líneas 1015-1026: Orden de cocina usa función centralizada

### Impacto Visual

**Tickets de venta:**
- Antes: Fecha en 3 líneas, hora en formato 24h
- Después: Una línea compacta con formato 12h

**Listados:**
- Antes: `19 ene 2026, 14:30`
- Después: `19 ene 2026, 02:30 PM`

---

## 🚀 Cómo Usar en Nuevos Componentes

```javascript
// 1. Importar
import { formatDate, formatTimeOnly } from '../../utils/formatters.js';

// 2. Usar en JSX
function MiComponente({ datos }) {
  return (
    <div>
      {/* Fecha y hora completa */}
      <p>{formatDate(datos.timestamp)}</p>
      
      {/* Solo hora */}
      <span>{formatTimeOnly(datos.timestamp)}</span>
      
      {/* Para ticket */}
      <div className="ticket">
        {formatDateTimeTicket(datos.timestamp)}
      </div>
    </div>
  );
}

// 3. Para reportes/exportaciones
const csvRow = `${datos.id},${formatDateTimeReport(datos.timestamp)},${datos.total}`;
// Output: "12345,19/01/2026 02:30 PM,150000"
```

---

## ❓ FAQ

**P: ¿Puedo cambiar a formato 24h en el futuro?**  
R: Sí, solo cambiar `hour12: true` a `hour12: false` en `formatters.js`.

**P: ¿Funciona en todos los navegadores?**  
R: Sí, `toLocaleString` es soportado por todos los navegadores modernos.

**P: ¿Qué pasa si el usuario está en otra zona horaria?**  
R: Siempre mostrará hora de Colombia (`America/Bogota`) independientemente de dónde esté el usuario.

**P: ¿Cómo pruebo que funciona correctamente?**  
R: 
1. Crear una venta
2. Ver el listado (debe mostrar AM/PM)
3. Imprimir ticket (debe mostrar día completo + hora 12h)

---

**Última actualización:** 19 de enero de 2026  
**Documentación completa:** [docs/FORMATO_12_HORAS.md](./FORMATO_12_HORAS.md)
