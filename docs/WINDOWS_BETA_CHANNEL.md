# Canal beta Windows (MVP offline)

Objetivo: distribuir builds controladas (x64/arm64) a un grupo piloto, con rollback simple y trazabilidad por versión.

## 1) Build por arquitectura

Desde la raíz del repo:

- x64: `npm run desktop:build:x64`
- arm64: `npm run desktop:build:arm64`
- ambas: `npm run desktop:build:all`

Artefactos esperados en `release/`:
- `Stocky Setup <version>.exe`
- `Stocky <version>.exe` (portable)
- `latest.yml`
- carpetas `win-unpacked/` o `win-arm64-unpacked/` según arquitectura.

## 2) Convención de versión beta

Usar semver con prerelease:
- `1.0.1-beta.1`
- `1.0.1-beta.2`

Subir la versión en `package.json` antes de cada entrega beta.

## 3) Grupo piloto recomendado

- Tamaño: 5–15 negocios.
- Mezcla: al menos 1 equipo arm64 y resto x64.
- Criterios: operación diaria de caja y uso de impresión offline.

## 4) Entrega de build

Por cada beta, compartir:
- instalador NSIS
- portable
- changelog corto (3–7 bullets)
- hash SHA256 de cada archivo

Checklist mínimo de publicación:
- `npm run test:offline` en verde
- instalación limpia en Windows 10 y 11
- smoke test de impresión y sincronización

## 5) Proceso de actualización

### Opción inicial (recomendada para MVP)
Actualización manual guiada:
1. Descargar nueva beta.
2. Cerrar app.
3. Instalar encima (NSIS) o reemplazar portable.
4. Abrir y validar versión visible.

### Opción posterior (post-MVP)
Auto-update con feed estable por canal (`latest.yml` beta/stable) y firma de binarios.

## 6) Rollback

Mantener siempre N-1 disponible:
- conservar último instalador estable y último beta previo.
- si se detecta bloqueo crítico, volver a N-1 el mismo día.

## 7) Señales para promoción a estable

Promover beta a estable si durante 7 días:
- 0 pérdidas de ventas offline
- 0 duplicados tras reconexión
- impresiones operativas en >95% de casos
- sin incidentes de stock negativo
