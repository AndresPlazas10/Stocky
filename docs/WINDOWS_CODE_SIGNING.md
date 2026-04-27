# Firma de binarios Windows (Electron)

Objetivo: generar instaladores y portables firmados para reducir SmartScreen warnings y habilitar un canal de distribución confiable.

## 1) Requisitos

- Certificado de firma de código para Windows (`.pfx` o token HSM).
- Password del certificado.
- Timestamp server confiable (RFC3161).

## 2) Variables de entorno (electron-builder)

Electron Builder detecta firma por variables de entorno.

Variables mínimas:
- `CSC_LINK` → ruta/URL al `.pfx`
- `CSC_KEY_PASSWORD` → password del certificado

Opcionales recomendadas:
- `WIN_CSC_LINK` y `WIN_CSC_KEY_PASSWORD` (si quieres separar firma solo para Windows)

## 3) Comandos de build firmado

Desde la raíz:

- x64: `npm run desktop:build:signed:x64`
- arm64: `npm run desktop:build:signed:arm64`
- ambas: `npm run desktop:build:signed:all`

Estos comandos activan `forceCodeSigning=true`, por lo que el build falla si no se firma.

## 4) Ejemplo rápido (macOS/Linux shell)

```bash
export CSC_LINK="/absolute/path/certificado.pfx"
export CSC_KEY_PASSWORD="tu_password"
npm run desktop:build:signed:x64
```

## 5) Ejemplo rápido (PowerShell)

```powershell
$env:CSC_LINK="C:\ruta\certificado.pfx"
$env:CSC_KEY_PASSWORD="tu_password"
npm run desktop:build:signed:x64
```

## 6) Verificación post-build

- Revisar artefactos en `release/`.
- En Windows:
  - Propiedades del `.exe` → pestaña **Firmas digitales**.
  - `Get-AuthenticodeSignature .\"Stocky Setup <version> x64.exe\"`

Estado esperado: firma válida y timestamp aplicado.

## 7) Recomendación operativa

- Usar builds `signed:*` para beta pública.
- Mantener builds no firmados solo para desarrollo interno.
- Registrar huella SHA256 y versión en cada entrega.
