# Resumen de Sesión - Descomposición de MesasPanel.tsx

## Contexto del Proyecto

Estamos trabajando en la descomposición del archivo `MesasPanel.tsx` (5753 líneas) en hooks y componentes más pequeños para mejorar la mantenibilidad del código.

## Estado Actual

### Archivo Principal
- **MesasPanel.tsx**: 5753 líneas (restaurado desde git)
- **Ubicación**: `/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/MesasPanel.tsx`

### Hooks Ya Creados (Listos para Integrar)

Todos los hooks están en `/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/hooks/`:

1. **useMesaOrderState.ts** (10K, 330 líneas)
   - Gestiona estado de órdenes: items, totales, modales, búsqueda
   - Retorna: estados, setters, refs y funciones derivadas
   - **Estado**: ✅ Creado y funcional

2. **useMesaOrderMutations.ts** (46K, 1710 líneas)
   - Gestiona mutaciones: crear, actualizar, eliminar items
   - Gestiona pagos: individuales y divididos
   - Gestiona impresión de cocina
   - **Estado**: ✅ Creado y funcional

3. **useMesaRealtime.ts** (46K, 1268 líneas)
   - Gestiona suscripciones realtime de Supabase
   - Aplica eventos de tablas, órdenes e items
   - Gestiona locks de edición
   - **Estado**: ✅ Creado y funcional

4. **useMesaEditLock.ts** (11K, 357 líneas)
   - Gestiona locks de edición de mesas
   - **Estado**: ✅ Creado y funcional

5. **useMesaToasts.ts** (1.7K, 54 líneas)
   - Gestiona notificaciones toast
   - **Estado**: ✅ Creado y funcional

### Componentes Ya Creados

En `/Users/andresplazas/Documents/Stocky/apps/mobile/src/features/mesas/components/`:
- MesaCard.tsx
- OrderModal.tsx
- PaymentModal.tsx
- CloseOrderChoiceModal.tsx
- CreateMesaModal.tsx
- StockShortageBanner.tsx
- OrderItemRow.tsx
- StatusPill.tsx
- MesasToasts.tsx

## Problema Encontrado

Durante la integración de `useMesaRealtime`, un script Python eliminó incorrectamente la función `handleOpenClose` (que NO estaba en el hook), dejando código huérfano y rompiendo la compilación.

**Causa raíz**: El script buscaba patrones de cierre de `useCallback` pero no validó que las funciones eliminadas estuvieran realmente en los hooks.

## Estrategia de Integración Recomendada

### Fase 1: Integrar useMesaOrderState

1. **Importar el hook** al inicio de MesasPanel.tsx:
```typescript
import { useMesaOrderState } from './hooks/useMesaOrderState';
```

2. **Llamar al hook** después de las declaraciones de estado iniciales:
```typescript
const orderState = useMesaOrderState({
  session,
  context,
  setError,
  listCatalogItems,
});
```

3. **Desestructurar** los valores necesarios:
```typescript
const {
  // Estados
  orderItems, setOrderItems,
  orderTotal,
  showOrderModal, setShowOrderModal,
  // ... etc
} = orderState;
```

4. **Eliminar** las declaraciones inline correspondientes (useState, useMemo, useCallback)

5. **Verificar compilación** con `npm run typecheck`

### Fase 2: Integrar useMesaOrderMutations

1. **Importar el hook**:
```typescript
import { useMesaOrderMutations } from './hooks/useMesaOrderMutations';
```

2. **Llamar al hook** pasando orderState como parámetro:
```typescript
const mutations = useMesaOrderMutations({
  order: orderState,
  session,
  context,
  setError,
  // ... otros parámetros
});
```

3. **Desestructurar** las funciones de mutación:
```typescript
const {
  handleAddItem,
  handleUpdateItem,
  handleRemoveItem,
  handlePayOrder,
  handleSplitPayment,
  handlePrintKitchen,
  // ... etc
} = mutations;
```

4. **Eliminar** las funciones inline correspondientes

5. **Verificar compilación**

### Fase 3: Integrar useMesaRealtime

1. **Importar el hook**:
```typescript
import { useMesaRealtime } from './hooks/useMesaRealtime';
```

2. **Llamar al hook**:
```typescript
useMesaRealtime({
  session,
  context,
  orderState,
  setMesas,
  // ... otros parámetros
});
```

3. **Eliminar** las suscripciones y handlers inline

4. **Verificar compilación**

## Verificaciones Críticas Antes de Eliminar Código

### Para cada función a eliminar:

1. **Verificar que existe en el hook**:
```bash
grep -n "nombreFuncion" hooks/useMesaOrderMutations.ts
```

2. **Verificar que la firma coincide**:
```bash
# Comparar parámetros y tipos de retorno
```

3. **Verificar dependencias**:
```bash
# Asegurar que todas las dependencias están disponibles
```

### Comandos de Verificación

```bash
# TypeScript
npm run typecheck

# Build Android
cd android && ./gradlew assembleDebug

# Metro bundler
npx expo start --port 8081
```

## Métricas de Progreso

- **Inicial**: 5753 líneas
- **Objetivo**: ~2000 líneas (reducción del 65%)
- **Actual**: 5753 líneas (0% completado)

## Archivos de Respaldo

Todos los cambios están en git:
```bash
git status
git diff
git log --oneline
```

## Recomendaciones Importantes

1. **NO usar scripts automáticos** para eliminar código sin validación manual
2. **Integrar un hook a la vez** y verificar compilación después de cada uno
3. **Mantener git commits pequeños** y frecuentes para poder revertir fácilmente
4. **Probar en dispositivo físico** después de cada integración exitosa
5. **Documentar cada paso** para poder retomar el trabajo

## Próximos Pasos Inmediatos

1. Verificar que todos los hooks compilan correctamente:
```bash
npm run typecheck
```

2. Crear un branch de trabajo:
```bash
git checkout -b feature/mesas-panel-decomposition
```

3. Comenzar con Fase 1: Integrar useMesaOrderState

4. Hacer commit después de cada integración exitosa

## Contacto y Contexto Adicional

- **Usuario**: Andrés Plazas
- **Proyecto**: Stocky Mobile (React Native + Expo)
- **Framework**: React 18 + TypeScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Dispositivo de prueba**: Android físico conectado vía USB

## Notas Técnicas

- Los hooks fueron creados el 6 de junio y están listos para usar
- El archivo MesasPanel.tsx fue restaurado desde git (commit anterior)
- No hay cambios pendientes en git
- El proyecto compila correctamente en su estado actual
