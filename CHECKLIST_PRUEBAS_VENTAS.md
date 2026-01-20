# ✅ CHECKLIST DE PRUEBAS - SISTEMA DE VENTAS SIN FACTURACIÓN

## 📋 Fecha: 16 de enero de 2026

---

## 🎯 Objetivo
Verificar que el sistema de ventas funciona correctamente después de deprecar la facturación electrónica.

---

## ✅ PRUEBAS DE INTERFAZ (UI)

### 1. Pantalla de Ventas (VentasNew.jsx)
- [ ] **Abrir sección de Ventas**
  - URL: http://localhost:5173 → Ventas
  - No debe haber errores en consola

- [ ] **Verificar advertencia de comprobante**
  - Debe aparecer disclaimer: "Comprobante informativo (sin validez fiscal)"
  - Color: Fondo amarillo/ámbar
  - Ícono: Triángulo de advertencia
  - Texto: Menciona que NO es válido ante DIAN

- [ ] **NO debe aparecer selector de tipo de documento**
  - ❌ NO debe haber radio buttons "Comprobante" vs "Factura"
  - ✅ Solo debe haber mensaje informativo fijo

- [ ] **Botón de procesar venta**
  - Texto: "🧾 Generar Comprobante"
  - Color: Azul (no verde)
  - No debe mencionar "factura electrónica"

---

### 2. Creación de Venta Paso a Paso

#### Paso 1: Agregar productos
- [ ] Buscar producto en buscador
- [ ] Agregar 2-3 productos diferentes al carrito
- [ ] Verificar que se calcule el total correctamente
- [ ] Verificar que NO aparezca opción de factura electrónica

#### Paso 2: Procesar venta
- [ ] Seleccionar método de pago (efectivo/tarjeta)
- [ ] Click en "🧾 Generar Comprobante"
- [ ] **CRÍTICO**: Verificar que NO aparezcan errores como:
  - ❌ "column 'is_electronic_invoice' does not exist"
  - ❌ "column 'document_type' does not exist"
  - ❌ "null value in column 'electronic_invoice_id'"

#### Paso 3: Verificar resultado
- [ ] Debe aparecer mensaje de éxito: "✅ Venta registrada"
- [ ] El carrito debe vaciarse automáticamente
- [ ] La venta debe aparecer en el listado de ventas

---

## 🔍 PRUEBAS DE BASE DE DATOS

### 3. Verificar datos guardados

Ejecutar en Supabase SQL Editor:

```sql
-- Ver última venta creada
SELECT 
  id,
  business_id,
  total,
  payment_method,
  created_at,
  electronic_invoice_id  -- Debe ser NULL
FROM sales 
WHERE business_id = 'TU_BUSINESS_ID'  -- Reemplazar con ID real
ORDER BY created_at DESC 
LIMIT 1;
```

**Verificar:**
- [ ] `electronic_invoice_id` debe ser `NULL`
- [ ] NO debe haber columnas `is_electronic_invoice` o `document_type`
- [ ] `total`, `payment_method` deben tener valores correctos
- [ ] Debe tener `created_at` reciente

---

### 4. Verificar items de venta

```sql
-- Ver items de la última venta
SELECT 
  si.*
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.business_id = 'TU_BUSINESS_ID'
ORDER BY s.created_at DESC, si.created_at DESC
LIMIT 10;
```

**Verificar:**
- [ ] Los productos se guardaron correctamente
- [ ] Cantidades y precios son correctos
- [ ] NO hay referencias a facturación

---

## 🧪 PRUEBAS DE CONSOLA DEL NAVEGADOR

### 5. Verificar errores JavaScript

Abrir DevTools (F12) → Console

**NO deben aparecer:**
- [ ] ❌ Errores de "undefined" relacionados con `canGenerateElectronicInvoice`
- [ ] ❌ Warnings sobre `documentType`
- [ ] ❌ Errores de red 400/500 al crear venta
- [ ] ❌ Mensajes sobre columnas inexistentes

**SÍ deben aparecer:**
- [ ] ✅ Logs normales de carga de componentes
- [ ] ✅ Mensaje de éxito al crear venta (si aplica)

---

## ⚙️ PRUEBAS DE CONFIGURACIÓN

### 6. Página de Configuración Siigo

Ir a: Ajustes → Configuración Siigo

**Verificar:**
- [ ] Aparece mensaje: "Stocky ya no es proveedor de facturación electrónica"
- [ ] Badge "⚠️ No disponible"
- [ ] Instrucciones de cómo facturar en Siigo directamente
- [ ] NO debe haber formulario de credenciales
- [ ] NO debe haber botones "Guardar configuración"

---

## 📊 VERIFICACIÓN DE ESTADO FINAL

### 7. Resumen de tablas deprecadas

Ejecutar en Supabase:

```sql
SELECT * FROM deprecated_invoicing_summary;
```

**Verificar:**
- [ ] Todas las tablas marcadas como DEPRECATED
- [ ] `registros_historicos` muestra cantidades correctas
- [ ] Vista se ejecuta sin errores

---

### 8. Verificar que ningún negocio tiene facturación activa

```sql
SELECT 
    id, 
    name, 
    invoicing_enabled, 
    invoicing_provider
FROM businesses 
WHERE invoicing_enabled = true;
```

**Resultado esperado:**
- [ ] 0 filas (ningún negocio con facturación activa)

---

## 🚨 PRUEBAS DE REGRESIÓN

### 9. Funcionalidades que deben seguir funcionando

- [ ] Agregar productos al carrito
- [ ] Eliminar productos del carrito
- [ ] Modificar cantidades en el carrito
- [ ] Cambiar método de pago
- [ ] Ver historial de ventas
- [ ] Eliminar ventas (si permitido)
- [ ] Buscar ventas por fecha
- [ ] Exportar/imprimir comprobantes

---

## 📝 NOTAS Y OBSERVACIONES

### Errores encontrados:
```
(Anotar cualquier error que aparezca durante las pruebas)
```

### Comportamiento inesperado:
```
(Anotar cualquier comportamiento extraño)
```

---

## ✅ CRITERIOS DE ACEPTACIÓN

**La migración es exitosa si:**

1. ✅ Las ventas se crean SIN errores de columnas inexistentes
2. ✅ NO aparece opción de "Factura electrónica" en la UI
3. ✅ Los disclaimers legales están visibles
4. ✅ La página de configuración Siigo muestra mensaje informativo
5. ✅ NO hay errores en consola del navegador
6. ✅ Los datos se guardan correctamente en la DB
7. ✅ `electronic_invoice_id` es NULL en todas las ventas nuevas

---

## 📞 CONTACTO EN CASO DE PROBLEMAS

Si encuentras errores:
1. Captura screenshot del error
2. Copia el error de la consola
3. Anota los pasos exactos para reproducirlo
4. Reporta al equipo de desarrollo

---

**Fecha de prueba:** _______________
**Probador:** _______________
**Resultado:** ✅ APROBADO / ❌ RECHAZADO
**Comentarios:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```
