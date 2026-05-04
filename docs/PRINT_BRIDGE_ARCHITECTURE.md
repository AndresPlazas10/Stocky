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

- `src/utils/printer.js`: guarda configuracion local del bridge, token, endpoint, nombre de impresora y ancho `58/80/104mm`.
- `src/utils/receiptTemplate.js`: genera el recibo estructurado de venta.
- `src/utils/printBridgeClient.js`: envia recibos al bridge local y expone la etiqueta de impresora configurada.
- `src/utils/saleReceiptPrint.js`: intenta imprimir con bridge y conserva `window.print()` como respaldo.
- `src/pages/Download.jsx`: muestra descargas de Stocky Print Bridge Android y Windows.

## Siguiente Bloque

1. Instalar dependencias y probar `apps/print-bridge-windows` en una maquina Windows con una impresora Bluetooth emparejada.
2. Crear `apps/print-bridge-android` con Kotlin y Bluetooth clasico.
3. Mover recibos de cocina al mismo contrato estructurado.
4. Agregar editor de recibos con campos permitidos y vista previa termica.

## Bridge Windows

El primer scaffold vive en `apps/print-bridge-windows`.

- Electron muestra la UI de configuracion.
- `serialport` lista y escribe en puertos COM.
- `POST /v1/print` valida origen, token y secciones obligatorias.
- El recibo se serializa a ESC/POS en `src/escpos.cjs`.
- El instalador esperado se genera con `npm run build`.
