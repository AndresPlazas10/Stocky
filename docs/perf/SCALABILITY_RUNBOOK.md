# Runbook de Escalabilidad (Stocky)

## Objetivo
Mantener tiempos de respuesta estables al escalar a ~200 negocios sin agregar infraestructura externa.

## Metas de rendimiento
- Web: p95 listados < 300ms
- Móvil: p95 listados < 500ms
- Realtime visible < 1s

## Señales de alerta
- Listados tardan > 2s con pocos registros.
- Realtime se desconecta con frecuencia o tarda > 3s en reflejar cambios.
- Render del dashboard se congela al abrir inventario o proveedores.

## Diagnóstico rápido
1. Verificar que la app use paginación en listados (empleados, proveedores, inventario).
2. Revisar índices activos en DB (especialmente `business_id + created_at`).
3. Confirmar que los eventos realtime estén filtrados por `business_id`.
4. Revisar payloads de listados: solo columnas necesarias.

## Acciones de mitigación
- Aumentar tamaño de página si el usuario necesita listas más grandes (sin exceder 200-300).
- Forzar refresh con polling si realtime se degrada.
- Validar que los RPCs de listados se usen (ventas, compras, inventario).

## Validación post-cambio
- Medir tiempo de carga con datos reales (p95).
- Confirmar que "Cargar más" funcione sin reiniciar listas.
- Verificar que el bloqueo de negocio sigue activo en web y móvil.

## Notas
- Para catálogos (productos/combos/proveedores), se usa cache en sesión con invalidación puntual.
- Los cambios en inventario/suppliers limpian el cache de catálogos.
