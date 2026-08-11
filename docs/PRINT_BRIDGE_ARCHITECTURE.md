# Stocky Print Bridge

## Objetivo

Stocky Print Bridge reemplaza RAWbt con un puente propio para impresoras termicas Bluetooth clasico compatibles con ESC/POS. Stocky Web, Mobile y Desktop deben enviar trabajos de impresion a un contrato comun, y cada plataforma del bridge se encarga de conectar con la impresora local.

## Contrato Local

Cuando la integracion web esta activa, el bridge local debe exponer:

```txt
POST /v1/print
Host: 127.0.0.1:41780
Content-Type: application/json
X-Stocky-Bridge-Token: <token-emparejado>
X-Stocky-Origin: <origen-stocky>
```

Payload:

```json
{
  "source": "stocky",
  "paperWidthMm": 80,
  "receipt": {
    "type": "sale",
    "version": 1,
    "requiredSections": ["items", "totals"],
    "header": {},
    "metadata": [],
    "items": [],
    "totals": {},
    "payment": {},
    "footer": {}
  }
}
```

Respuesta esperada:

```json
{ "ok": true }
```

## Seguridad

- El bridge debe aceptar solo origenes oficiales de Stocky y `localhost` en desarrollo.
- Todo trabajo de impresion requiere `X-Stocky-Bridge-Token`.
- El token se genera durante el emparejamiento y se guarda localmente en Stocky y en el bridge.
- El bridge debe validar esquema antes de imprimir para evitar que el usuario elimine secciones obligatorias.

## Estado En El Repo

- `src/utils/printer.ts`: guarda ancho de papel `58/80/104mm` y auto-impresion.
- `src/utils/printBridgeClient.ts`: settings del bridge (enabled, endpoint, token), `checkPrintBridgeStatus` (`GET /v1/status`) y `sendReceiptToPrintBridge` (`POST /v1/print`) con errores clasificados.
- `src/utils/receiptTemplate.ts`: genera el recibo estructurado de venta (`buildSaleReceiptTemplate`) y de cocina (`buildKitchenReceiptTemplate`, `type: 'kitchen'`).
- `src/utils/saleReceiptPrint.ts`: intenta imprimir con bridge y conserva `window.print()` como respaldo (fallback con aviso).
- `src/utils/kitchenOrderPrint.ts`: misma estrategia para ordenes de cocina.
- `src/components/Dashboard/Configuracion.tsx`: seccion "Impresora termica" (endpoint, token, ancho de papel, auto-impresion, verificar conexion, impresion de prueba).
- `src/pages/Download.tsx`: muestra descargas de Stocky Print Bridge Android y Windows.

## Contrato de Recibos

El bridge acepta dos tipos de recibo:

| type | Validacion | Contenido |
|---|---|---|
| `sale` | items obligatorios + `totals.totalText` | Comprobante de venta completo |
| `kitchen` | items obligatorios (totals opcionales) | Orden de cocina: mesa, estado, items |

## Siguiente Bloque

1. Probar `apps/print-bridge-windows` v0.2.0 en una maquina Windows con impresora Bluetooth emparejada (venta + cocina).
2. Agregar editor de recibos con campos permitidos y vista previa termica.
3. (Opcional) Soporte de impresoras de red ESC/POS (raw TCP 9100) en el bridge.

## Bridge Windows

El primer scaffold vive en `apps/print-bridge-windows`.

- Electron muestra la UI de configuracion.
- `serialport` lista y escribe en puertos COM.
- `POST /v1/print` valida origen, token y secciones obligatorias.
- El recibo se serializa a ESC/POS en `src/escpos.cjs`.
- El instalador esperado se genera con `npm run build`.
