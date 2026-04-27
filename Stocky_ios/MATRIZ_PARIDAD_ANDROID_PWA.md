# Matriz de Paridad Visual 1:1 Android vs PWA (iOS)

## Objetivo
Garantizar paridad visual y de experiencia entre la app Android (AAB) y la PWA para iOS, modulo por modulo.

## Regla de aceptación 1:1
Una pantalla se marca como OK solo si cumple todos los puntos:
1. Misma jerarquia visual.
2. Mismos componentes base y estados (loading, vacio, error, exito).
3. Mismos textos clave y acciones principales.
4. Mismos espaciados y escala tipografica percibida.
5. Mismo flujo funcional para completar la tarea.

---

## Mapa de pantallas Android (fuente de verdad)

### Autenticación
- Android: `apps/mobile/src/screens/AuthScreen.tsx`
- PWA/Web objetivo: `src/pages/Login.jsx`, `src/pages/Register.jsx`
- Estado: PENDIENTE

### Dashboard / contenedor principal
- Android: `apps/mobile/src/navigation/AppNavigator.tsx`
- Android: `apps/mobile/src/screens/dashboard/DashboardSectionScreen.tsx`
- PWA/Web objetivo: `src/pages/Dashboard.jsx`, `src/components/Dashboard/*`
- Estado: PENDIENTE

### Home / Mesas
- Android: `apps/mobile/src/screens/dashboard/sections/HomeSection.tsx`
- Android: `apps/mobile/src/features/mesas/MesasPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Mesas.jsx`
- Estado: PENDIENTE

### Ventas
- Android: `apps/mobile/src/screens/dashboard/sections/VentasSection.tsx`
- Android: `apps/mobile/src/features/ventas/VentasPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Ventas.jsx`
- Estado: PENDIENTE

### Inventario
- Android: `apps/mobile/src/screens/dashboard/sections/InventarioSection.tsx`
- Android: `apps/mobile/src/features/inventario/InventarioPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Inventario.jsx`
- Estado: PENDIENTE

### Reportes
- Android: `apps/mobile/src/screens/dashboard/sections/ReportesSection.tsx`
- Android: `apps/mobile/src/features/reportes/ReportesPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Reportes.jsx`
- Estado: PENDIENTE

### Compras
- Android: `apps/mobile/src/features/compras/ComprasPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Compras.jsx`
- Estado: PENDIENTE

### Configuración
- Android: `apps/mobile/src/features/configuracion/ConfiguracionPanel.tsx`
- PWA/Web objetivo: `src/components/Dashboard/Configuracion.jsx`
- Estado: PENDIENTE

---

## Checklist de auditoría visual por módulo

Copiar este bloque por cada módulo y llenar durante implementación:

- [ ] Header (titulo, subtitulo, acciones)
- [ ] Contenedores (cards, panels, bordes, sombras)
- [ ] Inputs (alto, radio, iconos, placeholders)
- [ ] Botones (primario, secundario, ghost, disabled)
- [ ] Estados vacíos
- [ ] Estados de carga
- [ ] Estados de error
- [ ] Espaciado vertical/horizontal equivalente
- [ ] Tipografía equivalente (peso, tamaño, contraste)
- [ ] Navegación y jerarquía de acciones equivalente

---

## Fase de ejecución recomendada

1. Login/Register
2. Dashboard shell (layout general y navegación)
3. Mesas (prioridad alta por operación diaria)
4. Ventas
5. Inventario
6. Reportes
7. Compras
8. Configuración

---

## Paso actual

Paso 1 completado:
- Base técnica PWA implementada (manifest, service worker y registro automático).

Paso 2 en curso:
- Matriz de paridad creada.
- Siguiente acción: iniciar implementación visual 1:1 en Login/Register.
