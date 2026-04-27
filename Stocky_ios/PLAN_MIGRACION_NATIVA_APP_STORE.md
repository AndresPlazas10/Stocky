# Plan Maestro Multi-Plataforma Stocky (Android + iOS + Windows)

## Objetivo
Tener 3 productos listos para distribucion:
1. App Android en formato AAB para Google Play.
2. App iOS para App Store.
3. App de escritorio para Windows (instalable).

## Entregables obligatorios
1. Android: build firmada `.aab`.
2. iOS: build release para App Store Connect.
3. Windows: instalador `.exe` o `.msi` firmado (preferible) con auto-update controlado.

## Base tecnica actual (aprovechar lo que ya existe)
1. Movil ya existe en `apps/mobile` (Expo/React Native) con carpetas Android e iOS.
2. Escritorio ya tiene base en `electron` (main/preload).
3. Backend y autenticacion: Supabase.

Conclusion: no se debe crear otro proyecto desde cero; se consolida el existente para 3 canales.

---

## Arquitectura recomendada
1. Mantener una sola capa de negocio compartida (servicios, API, validaciones).
2. UI separada por plataforma:
   - Mobile: React Native (`apps/mobile`).
   - Desktop Windows: Electron + frontend web empaquetado.
3. Definir contratos de datos compartidos para evitar divergencias entre plataformas.

---

## Fase 0: Alineacion de alcance (2-3 dias)
Objetivo: fijar alcance realista para las 3 versiones.

Tareas:
1. Crear matriz de paridad funcional:
   - Web actual vs Mobile vs Windows.
2. Definir MVP comun (P0) y backlog diferido (P1/P2).
3. Identificar funciones que deben ser nativas por plataforma.

Salida:
1. Documento unico de alcance multi-plataforma.
2. Lista cerrada de features para Release 1.

---

## Fase 1: Hardening de app Mobile (Android+iOS) (7-10 dias)
Objetivo: que una sola app mobile entregue 2 binarios estables (AAB y iOS release).

Tareas:
1. Actualizar y fijar versiones de Expo/React Native y librerias criticas.
2. Limpiar manejo de variables de entorno y secretos.
3. Revisar permisos por plataforma (camara, notificaciones, fotos, etc.).
4. Asegurar navegacion, estado de sesion y recuperacion de errores.
5. Ajustar UX nativa minima para evitar rechazo en iOS.

Salida:
1. Build Android interna estable.
2. Build iOS interna estable.

---

## Fase 2: Pipeline Android (AAB) (3-4 dias)
Objetivo: publicar Android de forma repetible.

Tareas:
1. Configurar firma release (keystore segura).
2. Generar AAB reproducible en CI/CD.
3. Preparar ficha Google Play:
   - descripcion,
   - screenshots,
   - privacy policy,
   - data safety.
4. Test interno/cerrado en Play Console.

Salida:
1. AAB aprobada en testing de Play.

---

## Fase 3: Pipeline iOS (App Store) (4-6 dias)
Objetivo: cumplir requisitos de Apple y enviar a review.

Tareas:
1. Validar configuracion de bundle id, signing y capabilities.
2. Completar App Privacy y metadata en App Store Connect.
3. Verificar textos de permisos y soporte de cuenta.
4. Ejecutar beta en TestFlight con usuarios reales.
5. Enviar a review con notas para reviewer y credenciales demo.

Salida:
1. Build iOS enviada y lista para publicacion.

---

## Fase 4: App Windows (Electron) (6-9 dias)
Objetivo: tener instalador Windows estable para distribucion.

Tareas:
1. Definir shell desktop:
   - cargar build web local,
   - puente seguro por `preload` (sin exponer Node en renderer).
2. Configurar empaquetado con electron-builder o alternativa equivalente.
3. Generar instalador `.exe` o `.msi` para x64 (y ARM64 si aplica).
4. Configurar auto-update (opcional en v1, recomendado en v1.1).
5. Firmar codigo de Windows (recomendado para reputacion SmartScreen).
6. Probar instalacion limpia, actualizacion y desinstalacion.

Salida:
1. Instalador Windows listo para entrega.

---

## Fase 5: QA cruzado y release coordinado (5-7 dias)
Objetivo: lanzar 3 productos con calidad consistente.

Tareas:
1. Matriz de pruebas por plataforma:
   - auth,
   - ventas,
   - inventario,
   - red inestable,
   - sesion expirada,
   - errores de API.
2. Pruebas reales:
   - Android: minimo 2 gamas de dispositivos.
   - iOS: minimo 2 generaciones de iPhone.
   - Windows: Windows 10 y 11.
3. Resolver bugs P0/P1 antes de release general.

Salida:
1. Release candidate unificada para las 3 plataformas.

---

## Criterios de aceptacion por plataforma

Android:
1. Se genera AAB firmada sin pasos manuales fragiles.
2. Instalacion y flujo de ventas pasan QA.

iOS:
1. Cumple App Store Review Guidelines y privacidad declarada.
2. TestFlight validado con tasa de crash baja.

Windows:
1. Instalador ejecuta y la app inicia sin warnings criticos.
2. Flujo principal opera estable en Windows 10/11.

---

## Riesgos y mitigacion
1. Divergencia de funcionalidades entre plataformas:
   - Mitigar con matriz de paridad y criterios unicos de release.
2. Rechazo iOS por compliance:
   - Mitigar con checklist App Store antes de submission.
3. Alertas de seguridad en Windows (SmartScreen):
   - Mitigar con firma de codigo y reputacion de distribucion.
4. Build no reproducible:
   - Mitigar con CI/CD y versionado de dependencias.

---

## Cronograma sugerido (5-7 semanas)
1. Semana 1: Fase 0 + arranque Fase 1.
2. Semana 2: cierre Fase 1.
3. Semana 3: Fase 2 (Android).
4. Semana 4: Fase 3 (iOS).
5. Semana 5: Fase 4 (Windows).
6. Semana 6-7: Fase 5 y publicaciones coordinadas.

---

## Estructura de salida recomendada en el repo
1. `apps/mobile`: unica base de Android + iOS.
2. `electron`: proceso principal y preload de desktop.
3. `release/android`: AAB final y notas de release.
4. `release/ios`: metadata y evidencia de submission.
5. `release/windows`: instalador y checksum.

---

## Proximos pasos inmediatos
1. Confirmar MVP comun exacto para las 3 plataformas.
2. Congelar dependencias y preparar pipeline de build.
3. Definir responsable por canal:
   - Android,
   - iOS,
   - Windows,
   - QA.
4. Ejecutar sprint 1 con meta: primer build interna en los 3 canales.