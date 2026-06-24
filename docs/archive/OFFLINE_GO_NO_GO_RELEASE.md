# ✅ Go / No-Go — Release Offline (5 minutos)

Fecha: ____ / ____ / ______  
Responsable: ______________________  
Versión/Build: _____________________

---

## 1) Gate técnico rápido

- [ ] `npm run lint` OK
- [ ] `npm run test` OK
- [ ] `npm run test:offline` OK
- [ ] `npm run build` OK
- [ ] CI verde en `main`

---

## 2) Gate funcional offline (crítico)

- [ ] Venta offline simple registrada como `Pendiente sync`
- [ ] Cierre de mesa offline single OK
- [ ] Cierre de mesa offline split OK (sin duplicados)
- [ ] Reconexión sincroniza y deja `pending = 0` (o errores justificados)
- [ ] Mapeo `tempId -> remoteId` correcto (sin ventas duplicadas)

---

## 3) Gate de consistencia

- [ ] Stock local no queda negativo tras ventas/cierres consecutivos
- [ ] Rollback de stock funciona si falla cierre en segundo plano
- [ ] Locks de cierre (TTL) evitan doble cierre por recarga/doble click
- [ ] Reportes muestran totales y ganancia esperada (incluye combos)

---

## 4) Gate operativo

- [ ] Envío de comprobante por correo funciona
- [ ] Sin errores críticos en consola durante flujo completo
- [ ] Usuario de caja confirma operación fluida (sin bloqueos de UI)

---

## Decisión

- [ ] ✅ GO (publicar)
- [ ] ❌ NO-GO (bloquear release)

### Motivo (si NO-GO)

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Acciones inmediatas

- Owner técnico: ______________________
- ETA de corrección: __________________
- Re-test programado: _________________
