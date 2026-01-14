# 📋 Facturación Electrónica Opcional - Guía de Implementación

## Resumen

La facturación electrónica en Stockly es **completamente opcional**. Cada negocio puede elegir si desea activarla o no. Mientras no esté activada, el sistema genera **comprobantes de venta informativos** que no tienen validez fiscal ante la DIAN.

## Arquitectura

### Componentes Creados

```
src/
├── context/
│   └── InvoicingContext.jsx          # Estado global de facturación por negocio
├── components/
│   ├── Settings/
│   │   ├── InvoicingSection.jsx      # Sección de config de facturación
│   │   ├── InvoicingActivationFlow.jsx # Wizard de activación
│   │   └── SiigoConfiguration.jsx    # Configuración de credenciales Siigo
│   └── POS/
│       └── DocumentTypeSelector.jsx   # Selector comprobante/factura
└── services/
    └── salesService.js               # Modificado para soportar facturación
```

### Flujo de Usuario

```
┌─────────────────────────────────────────────────────────────┐
│                     NEGOCIO NUEVO                           │
│                                                             │
│  Facturación electrónica: ❌ No activa                      │
│  Opciones en POS: Solo "Comprobante de venta"               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CONFIGURACIÓN → Activar Facturación            │
│                                                             │
│  1. Usuario va a Configuración                              │
│  2. Click en "Activar facturación electrónica"              │
│  3. Wizard de 3 pasos:                                      │
│     - Información sobre qué es                              │
│     - Requisitos (NIT, resolución DIAN, cuenta Siigo)       │
│     - Confirmación                                          │
│  4. Ingresar credenciales de Siigo                          │
│  5. Verificar conexión                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEGOCIO CON FACTURACIÓN                    │
│                                                             │
│  Facturación electrónica: ✅ Activa                         │
│  Opciones en POS:                                           │
│    • Comprobante de venta (sin validez fiscal)              │
│    • Factura electrónica (válida DIAN)                      │
└─────────────────────────────────────────────────────────────┘
```

## Tipos de Documento

### 1. Comprobante de Venta (receipt)
- **Siempre disponible** para todos los negocios
- **Sin validez fiscal** ante la DIAN
- Se genera un ticket/recibo informativo
- No requiere datos fiscales del cliente
- Ideal para ventas rápidas a consumidor final

### 2. Factura Electrónica (invoice)
- **Solo disponible** si el negocio ha activado la facturación
- **Válida ante la DIAN**
- Incluye CUFE (código único)
- Incluye código QR de verificación
- Se envía automáticamente por email al cliente
- Requiere datos fiscales del cliente

## Uso en el POS

```jsx
// El componente VentasNew ahora muestra opciones según el estado

// Si canGenerateElectronicInvoice === false:
// - Solo muestra "Comprobante de venta"
// - Opción de factura electrónica está deshabilitada con mensaje

// Si canGenerateElectronicInvoice === true:
// - Muestra ambas opciones
// - El vendedor elige el tipo de documento
```

## API del Contexto de Facturación

```jsx
import { useInvoicing } from '../context/InvoicingContext';

function MiComponente() {
  const {
    isLoading,           // boolean - cargando estado
    isEnabled,           // boolean - facturación habilitada en settings
    isConfigured,        // boolean - credenciales Siigo configuradas
    isProduction,        // boolean - ambiente producción (vs pruebas)
    resolutionNumber,    // string - número de resolución DIAN
    resolutionExpired,   // boolean - resolución vencida
    resolutionExpiringSoon, // boolean - vence en menos de 30 días
    daysUntilExpiry,     // number - días hasta vencimiento
    canGenerateElectronicInvoice, // boolean - puede generar facturas
    refresh              // function - recargar estado
  } = useInvoicing();

  // canGenerateElectronicInvoice = isEnabled && isConfigured && !resolutionExpired
}
```

## Servicio de Ventas Actualizado

```javascript
// Antes
await createSale({
  businessId,
  cart,
  paymentMethod,
  total
});

// Ahora
await createSale({
  businessId,
  cart,
  paymentMethod,
  total,
  documentType: 'receipt' | 'invoice',  // Nuevo
  generateElectronicInvoice: boolean,   // Nuevo
  customerData: {...}                   // Opcional, para factura
});
```

## Campos Nuevos en Tabla `sales`

La tabla `sales` necesita estos campos adicionales:

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'receipt';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_electronic_invoice BOOLEAN DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_status TEXT; -- 'success', 'failed', 'pending'
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cufe TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_error TEXT;
```

## Configuración Requerida

### Variables de Entorno
```bash
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### Base de Datos
Ejecutar la migración `20260114_siigo_integration.sql` que crea:
- `business_siigo_credentials` - Credenciales Siigo por negocio
- `siigo_invoice_logs` - Historial de facturas
- `dane_cities` - Códigos DANE de ciudades

### Edge Function
Desplegar `supabase/functions/siigo-invoice/index.ts`

## Mensajes de Usuario

### En el POS (cuando no tiene facturación)
> ⚠️ El comprobante de venta **no tiene validez fiscal** ante la DIAN.
> Para generar facturas electrónicas, activa la facturación en Configuración.

### En Configuración (cuando no está activa)
> 📋 **La facturación electrónica es opcional**
> Puedes usar Stockly sin facturación electrónica y activarla cuando lo necesites.

### Advertencia de resolución próxima a vencer
> ⚠️ Tu resolución DIAN vence en X días
> Renueva tu resolución antes de que expire para continuar facturando.

## Próximos Pasos Sugeridos

1. **Formulario de datos de cliente** - Para facturas que requieren NIT/CC del comprador
2. **Historial de facturas** - Vista de facturas generadas con descarga de PDF
3. **Reenvío de factura** - Reenviar por email una factura ya generada
4. **Notas crédito** - Anulación parcial o total de facturas
5. **Reportes fiscales** - Resumen de facturas por período
