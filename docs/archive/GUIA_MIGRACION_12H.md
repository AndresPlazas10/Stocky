# 🔄 Guía de Migración a Formato 12 Horas

## Para Desarrolladores del Equipo Stocky

**Propósito:** Guiar la actualización de componentes existentes o nuevos para usar formato de 12 horas consistentemente.

---

## 🎯 Pasos para Migrar un Componente

### Paso 1: Identificar Formateo de Fechas Actual

Buscar en tu componente estos patrones:

```javascript
// ❌ Patrones a reemplazar:
new Date(timestamp).toLocaleString()
new Date(timestamp).toLocaleDateString()
new Date(timestamp).toLocaleTimeString()
timestamp.substr(11, 5)  // Extracción manual
```

### Paso 2: Importar Funciones Centralizadas

```javascript
// En la parte superior del archivo
import { 
  formatDate,           // Fecha y hora general
  formatDateOnly,       // Solo fecha
  formatTimeOnly,       // Solo hora
  formatDateLong,       // Formato largo
  formatDateTimeTicket  // Para tickets/impresiones
} from '../../utils/formatters.js';
```

### Paso 3: Reemplazar Código Existente

#### Ejemplo 1: Tabla de Datos

**ANTES:**
```jsx
function VentasTable({ ventas }) {
  return (
    <table>
      <tbody>
        {ventas.map(venta => (
          <tr key={venta.id}>
            <td>
              {new Date(venta.created_at).toLocaleDateString('es-CO')}
            </td>
            <td>
              {new Date(venta.created_at).toLocaleTimeString('es-CO')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**DESPUÉS:**
```jsx
import { formatDate } from '../../utils/formatters.js';

function VentasTable({ ventas }) {
  return (
    <table>
      <tbody>
        {ventas.map(venta => (
          <tr key={venta.id}>
            <td>{formatDate(venta.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### Ejemplo 2: Modal de Detalles

**ANTES:**
```jsx
function DetalleVenta({ venta }) {
  const fecha = new Date(venta.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const hora = new Date(venta.created_at).toLocaleTimeString('es-CO');
  
  return (
    <div>
      <h2>Venta #{venta.id}</h2>
      <p>Fecha: {fecha}</p>
      <p>Hora: {hora}</p>
    </div>
  );
}
```

**DESPUÉS:**
```jsx
import { formatDateLong } from '../../utils/formatters.js';

function DetalleVenta({ venta }) {
  return (
    <div>
      <h2>Venta #{venta.id}</h2>
      <p>{formatDateLong(venta.created_at)}</p>
    </div>
  );
}
```

#### Ejemplo 3: Generación de Tickets

**ANTES:**
```jsx
function imprimirTicket(venta) {
  const contenido = `
    <div>
      <h1>TICKET</h1>
      <p>${new Date(venta.created_at).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
      <p>${new Date(venta.created_at).toLocaleTimeString('es-ES')}</p>
      <p>Total: ${venta.total}</p>
    </div>
  `;
  
  window.print();
}
```

**DESPUÉS:**
```jsx
import { formatDateTimeTicket, formatPrice } from '../../utils/formatters.js';

function imprimirTicket(venta) {
  const contenido = `
    <div>
      <h1>TICKET</h1>
      <p>${formatDateTimeTicket(venta.created_at)}</p>
      <p>Total: ${formatPrice(venta.total)}</p>
    </div>
  `;
  
  window.print();
}
```

---

## 📋 Tabla de Decisión: ¿Qué Función Usar?

| Contexto | Función | Justificación |
|----------|---------|---------------|
| Listado general (tabla, cards) | `formatDate()` | Compacto pero completo |
| Filtros de rango de fechas | `formatDateOnly()` | Solo necesita la fecha |
| Reloj en vivo / hora actual | `formatTimeOnly()` | Solo muestra la hora |
| Encabezado de sección | `formatDateLong()` | Formato elegante y completo |
| Ticket POS / Recibo | `formatDateTimeTicket()` | Optimizado para impresión |
| UI móvil compacta | `formatTimeCompact()` | Ahorra espacio |
| Exportación CSV/Excel | `formatDateTimeReport()` | Formato numérico estándar |

---

## 🔍 Búsqueda de Código a Migrar

### Comando para encontrar código no migrado:

```bash
# Buscar toLocaleString sin importar formatDate
grep -r "toLocaleString" src/components --include="*.jsx" --include="*.js"

# Buscar toLocaleDateString
grep -r "toLocaleDateString" src/components --include="*.jsx" --include="*.js"

# Buscar toLocaleTimeString
grep -r "toLocaleTimeString" src/components --include="*.jsx" --include="*.js"
```

### Verificar archivos ya migrados:

```bash
# Buscar imports de formatters
grep -r "from.*formatters" src/components --include="*.jsx" --include="*.js"
```

---

## ⚠️ Casos Especiales

### Caso 1: Fecha en Estado de React

**ANTES:**
```jsx
const [fecha, setFecha] = useState('');

useEffect(() => {
  setFecha(new Date().toLocaleDateString('es-CO'));
}, []);
```

**DESPUÉS:**
```jsx
import { formatDateOnly } from '../../utils/formatters.js';

const [fecha, setFecha] = useState('');

useEffect(() => {
  setFecha(formatDateOnly(new Date()));
}, []);
```

### Caso 2: Filtros de Fecha (Input Date)

```jsx
// Input nativo usa formato YYYY-MM-DD internamente
// NO necesita migración para el value

function FiltroFecha({ onChangeInicio }) {
  return (
    <input 
      type="date" 
      onChange={(e) => onChangeInicio(e.target.value)}
      // value sigue siendo YYYY-MM-DD
    />
  );
}

// Solo formatear para MOSTRAR al usuario
import { formatDateOnly } from '../../utils/formatters.js';

function MostrarFiltroActivo({ fechaInicio }) {
  return (
    <span>
      Desde: {formatDateOnly(fechaInicio)}
    </span>
  );
}
```

### Caso 3: Comparación de Fechas

```javascript
// ✅ CORRECTO - Comparar timestamps, no strings formateados
const fecha1 = new Date(venta1.created_at);
const fecha2 = new Date(venta2.created_at);

if (fecha1 > fecha2) {
  // ...
}

// ❌ INCORRECTO - Nunca comparar fechas formateadas
const fecha1Str = formatDate(venta1.created_at);
const fecha2Str = formatDate(venta2.created_at);
if (fecha1Str > fecha2Str) { // ❌ Comparación de strings
  // ...
}
```

---

## 🧪 Testing de Componentes Migrados

### Test Manual Básico

1. **Verificar medianoche:**
   - Crear registro con timestamp `YYYY-MM-DD 00:00:00`
   - Debe mostrar `12:00 AM`

2. **Verificar mediodía:**
   - Crear registro con timestamp `YYYY-MM-DD 12:00:00`
   - Debe mostrar `12:00 PM`

3. **Verificar tarde:**
   - Crear registro con timestamp `YYYY-MM-DD 14:30:00`
   - Debe mostrar `02:30 PM`

### Test de Snapshot (React Testing Library)

```javascript
import { render } from '@testing-library/react';
import { formatDate } from '../../utils/formatters';

test('muestra fecha en formato 12h', () => {
  const timestamp = '2026-01-19T19:30:00+00:00';
  const resultado = formatDate(timestamp);
  
  expect(resultado).toContain('PM');
  expect(resultado).not.toContain('19:30');
});
```

---

## 📝 Checklist de Migración por Componente

```markdown
## Componente: [Nombre del componente]

- [ ] Código revisado para formateo de fechas
- [ ] Imports agregados desde formatters.js
- [ ] toLocaleString reemplazado
- [ ] toLocaleDateString reemplazado
- [ ] toLocaleTimeString reemplazado
- [ ] Código manual de conversión eliminado
- [ ] Probado en navegador
- [ ] Verificado formato 12h con AM/PM
- [ ] Sin formato 24h visible
- [ ] Documentación actualizada (si aplica)
```

---

## 🚨 Errores Comunes y Soluciones

### Error 1: "formatDate is not defined"

**Causa:** Olvidaste importar la función.

**Solución:**
```javascript
import { formatDate } from '../../utils/formatters.js';
```

### Error 2: Sigue mostrando formato 24h

**Causa:** Usaste `toLocaleString` directamente sin `hour12: true`.

**Solución:** Usa siempre las funciones centralizadas:
```javascript
// ❌ INCORRECTO
date.toLocaleString('es-CO')

// ✅ CORRECTO
formatDate(date)
```

### Error 3: "Invalid Date" en consola

**Causa:** Timestamp inválido o null.

**Solución:** Las funciones ya manejan esto automáticamente:
```javascript
formatDate(null)        // "Sin fecha"
formatDate(undefined)   // "Sin fecha"
formatDate('invalid')   // "Fecha inválida"
```

### Error 4: Zona horaria incorrecta

**Causa:** Navegador usa su zona horaria local.

**Solución:** Las funciones ya fuerzan `America/Bogota`:
```javascript
// Ya incluido en formatters.js
timeZone: 'America/Bogota'
```

---

## 🔧 Herramientas de Desarrollo

### VSCode Snippets

Agregar a `.vscode/snippets.code-snippets`:

```json
{
  "Import formatters": {
    "prefix": "impform",
    "body": [
      "import { formatDate, formatDateOnly, formatTimeOnly } from '../../utils/formatters.js';"
    ],
    "description": "Importar funciones de formateo"
  },
  "Format Date": {
    "prefix": "fdate",
    "body": [
      "{formatDate(${1:timestamp})}"
    ],
    "description": "Formatear fecha con hora"
  },
  "Format Date Only": {
    "prefix": "fdateonly",
    "body": [
      "{formatDateOnly(${1:timestamp})}"
    ],
    "description": "Formatear solo fecha"
  }
}
```

### ESLint Rule (Opcional)

Crear regla personalizada para detectar uso directo de `toLocaleString`:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.property.name=/toLocale(String|DateString|TimeString)/]',
        message: 'Usa las funciones de formatters.js en lugar de toLocaleString directamente'
      }
    ]
  }
};
```

---

## 📊 Reporte de Migración

### Template para PR/Commit

```markdown
## Migración a Formato 12 Horas

### Componente(s) afectado(s):
- [ ] ComponenteA.jsx
- [ ] ComponenteB.jsx

### Cambios realizados:
- Importado funciones de formatters.js
- Reemplazado toLocaleString por formatDate
- Reemplazado toLocaleTimeString por formatTimeOnly
- Eliminado código manual de formateo

### Testing:
- [x] Verificado formato 12h en UI
- [x] Verificado medianoche (12:00 AM)
- [x] Verificado mediodía (12:00 PM)
- [x] Sin errores en consola

### Screenshots:
[Agregar capturas antes/después]
```

---

## 🎓 Recursos de Aprendizaje

### Documentación Interna
- [docs/FORMATO_12_HORAS.md](./FORMATO_12_HORAS.md) - Documentación completa
- [docs/GUIA_RAPIDA_12H.md](./GUIA_RAPIDA_12H.md) - Guía rápida con ejemplos
- [docs/EJEMPLOS_VISUALES_12H.md](./EJEMPLOS_VISUALES_12H.md) - Ejemplos visuales

### Código de Referencia
- [src/utils/formatters.js](../src/utils/formatters.js) - Funciones centralizadas
- [src/components/Dashboard/Ventas.jsx](../src/components/Dashboard/Ventas.jsx) - Ejemplo migrado
- [src/components/Dashboard/Mesas.jsx](../src/components/Dashboard/Mesas.jsx) - Ejemplo migrado

---

## ✅ Ejemplo Completo de Migración

### Antes de Migrar

```jsx
// src/components/Dashboard/Compras.jsx (ANTES)
import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/Client';

function Compras() {
  const [compras, setCompras] = useState([]);

  // Código de carga...

  return (
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Hora</th>
          <th>Proveedor</th>
        </tr>
      </thead>
      <tbody>
        {compras.map(compra => (
          <tr key={compra.id}>
            <td>
              {new Date(compra.created_at).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </td>
            <td>
              {new Date(compra.created_at).toLocaleTimeString('es-CO')}
            </td>
            <td>{compra.supplier_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Compras;
```

### Después de Migrar

```jsx
// src/components/Dashboard/Compras.jsx (DESPUÉS)
import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/Client';
import { formatDate } from '../../utils/formatters.js';  // ← Importado

function Compras() {
  const [compras, setCompras] = useState([]);

  // Código de carga...

  return (
    <table>
      <thead>
        <tr>
          <th>Fecha y Hora</th>  {/* ← Combinado */}
          <th>Proveedor</th>
        </tr>
      </thead>
      <tbody>
        {compras.map(compra => (
          <tr key={compra.id}>
            <td>{formatDate(compra.created_at)}</td>  {/* ← Simplificado */}
            <td>{compra.supplier_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Compras;
```

**Beneficios:**
- ✅ Código más limpio y legible
- ✅ Menos líneas de código
- ✅ Formato consistente automáticamente
- ✅ Manejo de errores incluido
- ✅ Fácil de mantener

---

## 🚀 Próximos Pasos

1. **Revisar componentes existentes** con el comando grep
2. **Priorizar componentes** de alta visibilidad (Dashboard, Reportes)
3. **Migrar uno a uno** siguiendo esta guía
4. **Probar exhaustivamente** cada componente
5. **Documentar** cambios en commits

---

**Última actualización:** 19 de enero de 2026  
**Autor:** Equipo Stocky  
**Versión:** 1.0
