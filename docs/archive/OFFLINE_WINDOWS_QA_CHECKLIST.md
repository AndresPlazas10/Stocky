# ✅ QA guiado — MVP Offline Windows (Ventas + Mesas)

Fecha: ____ / ____ / ______  
Tester: ______________________  
Build: _______________________  
Equipo: Windows 10/11 ☐  | x64 ☐  | arm64 ☐

---

## 0) Preparación

- [ ] Abrir app desktop (build o `desktop:dev`).
- [ ] Iniciar sesión con negocio de pruebas.
- [ ] Confirmar que hay productos con stock controlado (`manage_stock = true`).
- [ ] Confirmar que hay al menos 1 combo activo con componentes.
- [ ] Abrir DevTools (si aplica) para capturar errores.

Datos de prueba sugeridos:
- Producto A (stock inicial): ______
- Producto B (stock inicial): ______
- Combo C (componentes): __________________

---

## 1) Venta online base (sanity)

1. Con internet, crear una venta simple (1–2 productos).
2. Verificar registro exitoso.

Validaciones:
- [ ] Venta aparece en historial.
- [ ] Método de pago correcto.
- [ ] Reportes actualizan total.
- [ ] No errores en consola.

---

## 2) Ventas offline consecutivas (cola/outbox)

1. Cortar internet.
2. Crear 3 ventas consecutivas desde Ventas.
3. Revisar panel de sync.

Validaciones:
- [ ] Cada venta se registra localmente.
- [ ] Cada venta queda `Pendiente sync`.
- [ ] Cola incrementa (`pending > 0`).
- [ ] Impresión offline funciona (si está activa).
- [ ] Sin bloqueos de UI.

---

## 3) Cierre offline de Mesas (single)

1. Abrir mesa offline.
2. Agregar productos/combos.
3. Cerrar orden (pago único).

Validaciones:
- [ ] Cierra sin error de red.
- [ ] Mesa queda disponible localmente.
- [ ] Se crea venta pendiente de sync.
- [ ] Vuelto (`amount_received`, `change_amount`, `change_breakdown`) visible en detalle.

---

## 4) Cierre offline de Mesas (split)

1. Abrir mesa offline con varios ítems.
2. Dividir cuenta y cerrar.

Validaciones:
- [ ] Se crean N ventas pendientes (una por subcuenta).
- [ ] No se duplica ninguna.
- [ ] Mesa se libera localmente.

---

## 5) Stock offline — escenarios mixtos (A3 crítico)

### 5.1 Productos simples
- [ ] Al vender offline, stock local baja correctamente.
- [ ] Al llegar a 0, bloquea nuevas ventas del producto.

### 5.2 Combos
- [ ] Al vender combo offline, descuenta componentes internos.
- [ ] Bloquea venta si un componente queda en 0.

### 5.3 No stock negativo
- [ ] Después de múltiples ventas/cierres consecutivos offline, ningún producto queda con stock < 0.

---

## 6) Reconexión + sincronización automática

1. Reconectar internet.
2. Esperar auto-sync.

Validaciones:
- [ ] `pending` de cola llega a 0 (o queda solo `error` justificable).
- [ ] IDs temporales pasan a IDs remotos sin duplicarse.
- [ ] Estado por venta pasa a `Sincronizada`.
- [ ] Se muestra `Último sync exitoso`.

---

## 7) Idempotencia / no duplicados

Validaciones:
- [ ] Cada venta offline existe una sola vez en historial final.
- [ ] No hay doble registro tras reconectar.
- [ ] Si hay conflicto, mensaje accionable visible y botón de reintento funcional.

---

## 8) Errores y recuperación

Forzar condición de error (si posible):
- [ ] Venta queda en `Error sync` con mensaje claro.
- [ ] `Reintentar sync` por item funciona.
- [ ] `Reintentar errores` global funciona.

---

## 9) Reportes + branding de métodos de pago

Validaciones:
- [ ] Ventas por bancos (Nequi, Bancolombia, Banco de Bogotá, Nu, Davivienda) aparecen separadas.
- [ ] Resumen de métodos de pago muestra logos de bancos.

---

## Resultado final (Go/No-Go MVP)

Criterios mínimos de salida:
- [ ] Operación offline sin bloquear caja.
- [ ] Sincronización automática sin duplicados.
- [ ] Stock consistente en simples + combos (sin negativos).
- [ ] Cierre de mesas offline estable (single + split).

Estado:
- [ ] ✅ APROBADO
- [ ] ❌ RECHAZADO

Hallazgos críticos:
1. __________________________________________
2. __________________________________________
3. __________________________________________

Notas:
______________________________________________
______________________________________________
