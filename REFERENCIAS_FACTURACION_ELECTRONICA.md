# 📋 RESUMEN: Referencias a Facturación Electrónica en el Código

## ✅ YA ACTUALIZADOS (No requieren cambios)
- `DocumentTypeSelector.jsx` - E-invoice permanentemente deshabilitado
- `ComprobanteDisclaimer.jsx` - Disclaimers legales implementados
- `PrimeraVentaModal.jsx` - Modal educativo implementado
- `ChangelogModal.jsx` - Mensajes actualizados
- `Terms.jsx` - Sección 8 completa
- `Ventas.jsx` - Print template con disclaimers

## ⚠️ REQUIEREN ACTUALIZACIÓN

### 1. `/src/services/salesService.js`
**Líneas 219, 250, 302-330, 355-425**

**Problema**: 
- Parámetro `generateElectronicInvoice` sigue existiendo
- Intentainserta `is_electronic_invoice` en tabla `sales` (columna NO existe)
- Función `generateElectronicInvoiceForSale()` completa (81 líneas)
- Llama a Edge Function `/functions/v1/siigo-invoice` (deprecada)

**Solución**:
- Eliminar parámetro `generateElectronicInvoice`
- Eliminar inserción de `is_electronic_invoice`
- Eliminar función `generateElectronicInvoiceForSale()`
- Eliminar lógica de generación de factura (líneas 300-332)

---

### 2. `/src/context/InvoicingContext.jsx`
**Líneas 30, 59, 76, 107**

**Problema**:
- Consulta columnas deprecadas: `invoicing_enabled`, `invoicing_provider`, `invoicing_activated_at`
- Consulta tablas deprecadas: `invoicing_requests`, `business_siigo_credentials`
- RPC `can_business_invoice` ya eliminado

**Solución**:
- Retornar siempre `canGenerateElectronicInvoice: false`
- Eliminar consultas a tablas deprecadas
- Simplificar contexto a solo retornar estado "deshabilitado"

---

### 3. `/src/services/siigoService.js`
**Todo el archivo (405 líneas)**

**Problema**:
- Llama a RPC `can_business_invoice()` (eliminado de DB)
- Llama a Edge Function `/functions/v1/siigo-invoice` (deprecada)
- Consulta `business_siigo_credentials` y `siigo_invoice_logs` (deprecadas)

**Solución**:
- **OPCIÓN A**: Eliminar archivo completo
- **OPCIÓN B**: Dejar solo stub functions que retornen false/disabled

---

### 4. `/src/components/Settings/SiigoConfiguration.jsx`
**Línea 147**

**Problema**:
- Llama a `siigoService.canBusinessInvoice()` que usa RPC eliminado

**Solución**:
- Eliminar o actualizar componente completo

---

### 5. `/src/hooks/useSiigoInvoice.js`
**Línea 30**

**Problema**:
- Llama a `siigoService.canBusinessInvoice()` que usa RPC eliminado

**Solución**:
- Hook debe retornar siempre estado deshabilitado

---

### 6. `/src/components/Dashboard/VentasNew.jsx`
**Líneas 89, 271**

**Problema**:
- Usa `canGenerateElectronicInvoice` del contexto
- Valida si se puede generar factura electrónica

**Solución**:
- Mantener validación (siempre será `false`)
- Mensaje de error ya correcto: "Para facturar usa Siigo"

---

## 🎯 PLAN DE ACCIÓN

### Prioridad ALTA (rompen funcionalidad):
1. ✅ **salesService.js** - Eliminar generación de factura
2. ✅ **InvoicingContext.jsx** - Simplificar a estado deshabilitado
3. ✅ **siigoService.js** - Convertir a stubs

### Prioridad MEDIA (warnings/errores):
4. SiigoConfiguration.jsx - Actualizar o deshabilitar
5. useSiigoInvoice.js - Retornar disabled

### Prioridad BAJA (ya funcionan):
6. VentasNew.jsx - Ya funciona (validación existe)

---

## 📊 MÉTRICAS

- **Archivos a modificar**: 5
- **Líneas a eliminar**: ~150
- **Líneas a agregar**: ~30
- **Funciones a deprecar**: 8
- **Consultas DB a eliminar**: 5

---

## 🚀 SIGUIENTE PASO

¿Quieres que aplique estos cambios automáticamente?

**Opción 1**: Aplicar TODO de una vez
**Opción 2**: Ir archivo por archivo
**Opción 3**: Solo prioridad ALTA
