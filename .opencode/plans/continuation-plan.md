# Plan de Continuacion - Fases 4-6

## Estado Actual (despues de commit 57e4de2)

- **MesasPanel.tsx**: 5176 lineas (reducido de 5753)
- **Fases completadas**: 1 (useMesaToasts), 2 (useMesaOrderState), 3 (useMesaEditLock)
- **Fases pendientes**: 4, 5, 6
- **Branch**: `feature/mesas-panel-decomposition`
- **Lineas eliminadas hasta ahora**: 577 (5753 → 5176)

## Proxima Sesion: Fase 4 - Integrar useMesaRealtime

### Rangos de lineas a leer en MesasPanel.tsx:
| Rango | Contenido | Lineas |
|-------|-----------|--------|
| 1-70 | Imports | 70 |
| 84-112 | RealtimeUiTrace type + helpers | 29 |
| 482-500 | useRef realtime timers | 19 |
| 563-681 | patchMesaOrderUnits + extractOrderUnitsSnapshot + applyOrderUnitsSnapshot | 119 |
| 1112-1880 | sendMesaSyncBroadcast + all realtime handlers | 769 |
| 1909-2076 | useEffect realtime subscription | 168 |

**Total a leer**: ~1174 lineas

### Rangos a leer en hooks/useMesaRealtime.ts:
| Rango | Contenido |
|-------|-----------|
| 1-130 | Types + helpers + function start |
| 1200-1268 | Return statement |

**Total a leer**: ~200 lineas (parcial)

### Cambios exactos:

1. **Agregar import**:
```typescript
import { useMesaRealtime, type HeldMesaLock } from './hooks/useMesaRealtime';
```

2. **Agregar llamada al hook**:
```typescript
const realtime = useMesaRealtime({
  businessId: String(context?.businessId || ''),
  userId: session.user.id,
  isOrderFlowActive,
  setMesas,
  setMesaLocksByTableId,
  setSelectedMesa,
  setOrderUnitsByOrderId,
  setShowOrderModal,
  setShowCloseOrderChoiceModal,
  setShowPaymentModal,
  setShowSplitBillModal,
  setShowPaymentMethodMenu,
  setPaymentMethod,
  setAmountReceived,
  setOrderItems,
  setSearchCatalog,
  setIsSearchFocused,
  setMutatingOrderItemId,
  setOrderModalError,
  publishMesaLockBroadcast,
  selectedMesaIdRef,
  heldMesaLockRef,
});

const {
  scheduleMesasRealtimeRefresh, scheduleMesaLocksRefresh,
  scheduleOrderRealtimeSummaryHydration, refreshMesasRealtime,
  mesasSyncBroadcastReadyRef, mesasSyncBroadcastChannelRef,
  pendingUiTraceRef, realtimeClientInstanceIdRef,
} = realtime;
```

3. **Eliminar declaraciones inline**:
   - Lineas 84-112: RealtimeUiTrace type + helpers (29 lineas)
   - Lineas 482-500: 8 useRef realtime timers (19 lineas)
   - Lineas 563-681: patchMesaOrderUnits + snapshots (119 lineas)
   - Lineas 1112-1880: realtime handlers (769 lineas)
   - Lineas 1909-2076: useEffect subscription (168 lineas)

**Total a eliminar**: ~1104 lineas

4. **Conservar en MesasPanel.tsx**:
   - `mesasLengthRef`, `hasLoadedOnceRef`
   - `mesaActionVersionRef` + `bumpMesaActionVersion` + `isMesaActionVersionCurrent`
   - `selectedMesaIdRef` (se pasa al hook pero se declara localmente)

5. **Verificar y commit**

---

## Sesion Final: Fase 5 - Integrar useMesaOrderMutations

### Rangos de lineas a leer en MesasPanel.tsx:
| Rango | Contenido | Lineas |
|-------|-----------|--------|
| 1-70 | Imports | 70 |
| 2160-2260 | releaseEmptyOrderAndClose + patchMesaOrderTotal + publishRealtimeOrderSummary | 101 |
| 2262-2440 | handleDismissOrderModal + openOrderModal | 179 |
| 2442-2530 | handleSaveOrder | 89 |
| 2750-2920 | handleAddCatalogItem + quantity sync | 171 |
| 2922-3110 | handleUpdateOrderItemQuantity + handleRemoveOrderItem + handlePrintKitchen | 189 |
| 3112-3210 | askReceiptPrintConfirmation + handlePrintConfirm/Cancel | 99 |
| 3350-3500 | handleCloseOrder + payment functions | 151 |

**Total a leer**: ~1048 lineas

### Rangos a leer en hooks/useMesaOrderMutations.ts:
| Rango | Contenido |
|-------|-----------|
| 106-248 | Params type |
| 1688-1710 | Return statement |

**Total a leer**: ~165 lineas (parcial)

### Cambios exactos:

1. **Agregar import**:
```typescript
import { useMesaOrderMutations } from './hooks/useMesaOrderMutations';
```

2. **Agregar llamada al hook** (despues de realtime):
```typescript
const mutations = useMesaOrderMutations({
  order: orderState,
  businessId: context?.businessId,
  source: context?.source,
  session,
  heldMesaLockRef,
  publishMesaLockBroadcast,
  publishMesaStateBroadcast,
  acquireMesaLockForEdition,
  releaseHeldMesaLock,
  bumpMesaActionVersion,
  isMesaActionVersionCurrent,
  loadOpenOrderSnapshot,
  addCatalogItemToOrder,
  syncOrderItemQuantity,
  removeOrderItemFromOrder,
  persistOrderSnapshot,
  closeOrderSingle,
  closeOrderAsSplit,
  patchMesaOrderUnits,
  patchMesaOrderTotal,
  publishRealtimeOrderSummary,
  setError,
  setMesas,
  clearMesaOrderUnits,
  markMesaAsAvailableAfterSale,
  loadData,
  beginPrintFlow,
  endPrintFlow,
  buildCashBreakdown,
  setPrintSalesData,
  setShowPrintModal,
});

const {
  closeAuxiliaryOrderModals, closeOrderModal,
  releaseEmptyOrderAndClose, flushPendingQuantityUpdates,
  scheduleQuantitySync, handleAddCatalogItem,
  handleUpdateOrderItemQuantity, handleRemoveOrderItem,
  handleSaveOrder, openOrderModal, handleCloseOrder,
  handlePayAllTogether, askReceiptPrintConfirmation,
  processPaymentAndClose, processSplitPaymentAndClose,
  handlePrintKitchen,
} = mutations;
```

3. **Eliminar funciones inline** (~987 lineas)

4. **Verificar y commit**

---

## Fase 6: Limpieza Final

1. Eliminar imports no usados
2. Mover funciones helper si es necesario
3. Verificar compilacion final
4. Commit final

---

## Comandos de Verificacion Rapida

```bash
# Contar lineas
wc -l apps/mobile/src/features/mesas/MesasPanel.tsx

# Verificar compilacion
npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | grep -i "MesasPanel" | head -20

# Verificar que una funcion existe en un hook
grep -n "export.*function\|const.*=.*useCallback" apps/mobile/src/features/mesas/hooks/useMesaEditLock.ts | grep nombreFuncion

# Git status
git status
git log --oneline -5
```

---

## Resumen de Progreso

| Fase | Estado | Lineas eliminadas | Lineas agregadas | Neto |
|------|--------|-------------------|------------------|------|
| 1. Toasts | ✅ Completada | 13 | 4 | -9 |
| 2. OrderState | ✅ Completada | 125 | 33 | -92 |
| 3. EditLock | ✅ Completada | 473 | 34 | -439 |
| 4. Realtime | ⏳ Pendiente | ~1104 | ~40 | ~-1064 |
| 5. Mutations | ⏳ Pendiente | ~987 | ~40 | ~-947 |
| 6. Limpieza | ⏳ Pendiente | ~50 | 0 | ~-50 |
| **Total** | **50% completo** | **~577** | **~77** | **~-500** |

**Resultado esperado despues de todas las fases**: ~3068 lineas (de 5753)

---

## Notas Importantes

1. **NO usar scripts automaticos** para eliminar codigo
2. **Leer solo los rangos indicados** en cada fase
3. **Verificar compilacion** despues de cada fase
4. **Hacer commit** despues de cada fase exitosa
5. **Si la compilacion falla**, revertir con `git checkout -- MesasPanel.tsx`
