# 📋 Plan de Implementación - Cambios Terminología Facturación

## Estado: EN PROGRESO

### ✅ Completado

1. **Advertencia en integración Siigo** (`supabase/functions/siigo-invoice/index.ts`)
   - Agregado disclaimer explicando por qué está deshabilitada
   - Mantiene código para referencia futura

2. **Componente de Disclaimer Legal** (`src/components/Legal/ComprobanteDisclaimer.jsx`)
   - Creado componente reutilizable con 4 variantes
   - Muestra advertencias legales claras
   - Incluye FacturacionReminder para banners

3. **Modal Educativo Primera Venta** (`src/components/Modals/PrimeraVentaModal.jsx`)
   - Modal que se muestra en primera venta
   - Explica modelo de facturación
   - Opción "no mostrar de nuevo"
   - Enlaces directos a Siigo

4. **ChangelogModal actualizado**
   - Cambiado terminología de "Facturación Electrónica" a "Comprobantes Informativos"
   - Actualizado mensaje para reflejar modelo actual
   - Enfoque en plan Siigo incluido

5. **DocumentTypeSelector actualizado**
   - Opción "Factura electrónica" deshabilitada permanentemente
   - Mensaje claro: "Usar Siigo directamente"
   - Disclaimer legal visible siempre

### 🔄 En Progreso

6. **Actualizar componente Ventas.jsx**
   - Cambiar textos de UI
   - Integrar PrimeraVentaModal
   - Actualizar template de impresión con disclaimers legales

### ⏳ Pendiente

7. **Actualizar otros componentes con referencias a "factura":**
   - `src/components/Dashboard/VentasNew.jsx`
   - `src/components/Dashboard/Mesas.jsx`
   - `src/pages/Home.jsx`
   - `src/context/InvoicingContext.jsx`

8. **Servicios y lógica de backend:**
   - `src/services/salesService.js` - Comentarios y logs
   - `src/utils/emailService.js` - Cambiar "factura" por "comprobante"

9. **Crear página de Términos y Condiciones:**
   - Nueva página con cláusula de responsabilidad fiscal
   - Sección 8 sobre facturación electrónica (según diseño)

10. **Crear sección "Centro de Facturación" (opcional):**
    - Tutorial de uso de Siigo
    - Enlace directo al login de Siigo
    - Exportador de ventas para Siigo
    - Checklist de ventas pendientes

## 📝 Notas Importantes

- **NO eliminar** la lógica de facturación existente, solo deshabilitar en UI
- **Mantener** las tablas `invoices` e `invoice_items` por si se reactiva en futuro
- **Enfatizar** en cada punto que Stocky NO emite facturas válidas ante DIAN
- **Promover** uso de Siigo incluido en el plan

## 🎯 Próximos Pasos Inmediatos

1. Terminar actualización de Ventas.jsx
2. Actualizar VentasNew.jsx (versión más reciente del componente)
3. Actualizar Mesas.jsx
4. Probar flujo completo de venta y verificar que:
   - Aparece modal educativo en primera venta
   - Comprobantes muestran disclaimers legales
   - No hay opción de generar factura desde Stocky
   - Textos son claros sobre ir a Siigo

## 🔗 Enlaces de Referencia

- Documento estratégico: Ver respuesta inicial del chat
- Textos legales: Sección 3 del documento estratégico
- Modelo de negocio: Sección 1 del documento estratégico
