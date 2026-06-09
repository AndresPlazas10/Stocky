# Plan de Integración Quirúrgica: useMesaEditLock en MesasPanel.tsx

## Objetivo
Reducir MesasPanel.tsx de 5,753 líneas a ~5,200 líneas integrando el hook `useMesaEditLock` sin romper funcionalidad.

## Estado Actual
- **MesasPanel.tsx**: 5,753 líneas (compila correctamente)
- **useMesaEditLock.ts**: 357 líneas (compila correctamente)
- **App**: Funciona en dispositivo físico

## Mapeo de Elementos a Reemplazar

### 1. Estados y Refs (2 elementos)
| Elemento | Línea en MesasPanel | Reemplazo desde Hook |
|----------|---------------------|----------------------|
| `mesaLocksByTableId` | 563 | `mesaLocksByTableId` del hook |
| `heldMesaLockRef` | 566 | `heldMesaLockRef` del hook |

### 2. Funciones Inline (6 funciones)
| Función | Líneas en MesasPanel | Líneas en Hook | Diferencia |
|---------|---------------------|----------------|------------|
| `refreshMesaLocks` | 827-839 (13 líneas) | 72-84 (13 líneas) | Idéntica |
| `publishMesaLockBroadcast` | 1028-1061 (34 líneas) | 86-121 (36 líneas) | Hook usa `sendBroadcast` callback |
| `releaseHeldMesaLock` | 1063-1115 (53 líneas) | 123-175 (53 líneas) | Idéntica |
| `acquireMesaLockForEdition` | 1117-1190 (74 líneas) | 177-254 (78 líneas) | Hook usa `onError` callback |
| `closeAuxiliaryOrderModals` | 2252-2258 (7 líneas) | 256-260 (5 líneas) | Hook usa `onCloseAuxiliaryOrderModals` callback |
| `closeOrderModal` | 2260-2274 (15 líneas) | 262-272 (11 líneas) | Hook usa `onLockLost` y `onHandleDismissOrderModal` callbacks |

**Total a eliminar**: ~196 líneas

## Plan de Ejecución (7 Pasos)

### PASO 1: Agregar Import del Hook
**Acción**: Agregar import al inicio del archivo (después de línea 65)

```typescript
import { useMesaEditLock } from './hooks/useMesaEditLock';
```

**Verificación**: 
```bash
curl -s "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" > /dev/null 2>&1 && echo "✅ Compila" || echo "❌ Error"
```

---

### PASO 2: Llamar al Hook y Desestructurar
**Acción**: Después de línea 567 (después de `canDeleteMesas`), agregar:

```typescript
const {
  mesaLocksByTableId,
  setMesaLocksByTableId,
  heldMesaLockRef,
  closeOrderModal: hookCloseOrderModal,
  handleDismissOrderModal,
  closeAuxiliaryOrderModals: hookCloseAuxiliaryOrderModals,
  publishMesaLockBroadcast,
  acquireMesaLockForEdition,
  releaseHeldMesaLock,
  refreshMesaLocks,
} = useMesaEditLock({
  session,
  context,
  actorDisplayName,
  onError: setError,
  isOrderFlowActive: isOrderModalOpen,
  onLockLost: () => {
    setShowOrderModal(false);
    setSelectedMesa(null);
    setOrderItems([]);
    setOrderModalError(null);
    setSearchCatalog('');
    setIsSearchFocused(false);
    setMutatingOrderItemId(null);
  },
  onCloseAuxiliaryOrderModals: () => {
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowSplitBillModal(false);
    setPaymentMethod('cash');
    setAmountReceived('');
  },
  onHandleDismissOrderModal: undefined,
  sendBroadcast: sendMesaSyncBroadcast,
});
```

**Nota**: Usamos aliases (`hookCloseOrderModal`, `hookCloseAuxiliaryOrderModals`) para evitar conflictos con las funciones inline existentes durante la transición.

**Verificación**: Compilar y verificar que no hay errores de duplicados.

---

### PASO 3: Eliminar Estados/Refs Inline
**Acción**: Eliminar líneas 563 y 566:

```typescript
// ELIMINAR:
const [mesaLocksByTableId, setMesaLocksByTableId] = useState<Record<string, MesaEditLock>>({});
// ELIMINAR:
const heldMesaLockRef = useRef<HeldMesaLock | null>(null);
```

**Verificación**: Compilar. Si hay errores de "already declared", continuar al siguiente paso.

---

### PASO 4: Eliminar `refreshMesaLocks` Inline
**Acción**: Eliminar líneas 827-839 (13 líneas):

```typescript
// ELIMINAR TODO ESTE BLOQUE:
const refreshMesaLocks = useCallback(async (businessId: string) => {
  const normalizedBusinessId = String(businessId || '').trim();
  if (!normalizedBusinessId) {
    setMesaLocksByTableId({});
    return;
  }
  try {
    const locks = await listActiveMesaEditLocks(normalizedBusinessId);
    applyMesaLocks(locks);
  } catch {
    // no-op: no bloquear flujo principal por locks
  }
}, [applyMesaLocks]);
```

**Verificación**: Compilar. Debe funcionar porque el hook expone `refreshMesaLocks`.

---

### PASO 5: Eliminar `publishMesaLockBroadcast` Inline
**Acción**: Eliminar líneas 1028-1061 (34 líneas):

```typescript
// ELIMINAR TODO ESTE BLOQUE:
const publishMesaLockBroadcast = useCallback((
  input: {
    businessId: string;
    tableId: string;
    locked: boolean;
    mode?: 'optimistic' | 'confirmed' | 'rollback';
    lockToken?: string | null;
    lockExpiresAt?: string | null;
  },
) => {
  const businessId = String(input.businessId || '').trim();
  const tableId = String(input.tableId || '').trim();
  if (!businessId || !tableId) return;

  const locked = Boolean(input.locked);
  const lockTtlMs = 45_000;
  const lockExpiresAt = locked
    ? (String(input.lockExpiresAt || '').trim() || new Date(Date.now() + lockTtlMs).toISOString())
    : null;

  sendMesaSyncBroadcast('mesa_lock_changed', {
    sender_user_id: session.user.id,
    sender_client_id: realtimeClientInstanceIdRef.current,
    mesa_id: tableId,
    business_id: businessId,
    locked,
    mode: input.mode || 'confirmed',
    lock_owner_user_id: locked ? session.user.id : null,
    lock_token: locked ? (String(input.lockToken || '').trim() || null) : null,
    lock_expires_at: lockExpiresAt,
    lock_ttl_ms: locked ? lockTtlMs : null,
    emitted_at: Date.now(),
  });
}, [sendMesaSyncBroadcast, session.user.id]);
```

**Verificación**: Compilar.

---

### PASO 6: Eliminar `releaseHeldMesaLock` y `acquireMesaLockForEdition` Inline
**Acción**: Eliminar líneas 1063-1190 (128 líneas):

```typescript
// ELIMINAR TODO ESTE BLOQUE (releaseHeldMesaLock):
const releaseHeldMesaLock = useCallback(async (lockSnapshot?: HeldMesaLock | null) => {
  // ... 53 líneas ...
}, [publishMesaLockBroadcast, refreshMesaLocks, session.user.id]);

// ELIMINAR TODO ESTE BLOQUE (acquireMesaLockForEdition):
const acquireMesaLockForEdition = useCallback(async (mesa: MesaRecord): Promise<boolean> => {
  // ... 74 líneas ...
}, [actorDisplayName, context?.businessId, publishMesaLockBroadcast, refreshMesaLocks, releaseHeldMesaLock, session.user.id]);
```

**Verificación**: Compilar.

---

### PASO 7: Eliminar `closeAuxiliaryOrderModals` y `closeOrderModal` Inline
**Acción**: Eliminar líneas 2252-2274 (23 líneas):

```typescript
// ELIMINAR TODO ESTE BLOQUE:
const closeAuxiliaryOrderModals = useCallback(() => {
  setShowCloseOrderChoiceModal(false);
  setShowPaymentModal(false);
  setShowSplitBillModal(false);
  setPaymentMethod('cash');
  setAmountReceived('');
}, []);

// ELIMINAR TODO ESTE BLOQUE:
const closeOrderModal = useCallback(() => {
  const held = heldMesaLockRef.current;
  if (held) {
    void releaseHeldMesaLock(held);
  }
  orderModalOpenIntentRef.current = false;
  closeAuxiliaryOrderModals();
  setShowOrderModal(false);
  setSelectedMesa(null);
  setOrderItems([]);
  setOrderModalError(null);
  setSearchCatalog('');
  setIsSearchFocused(false);
  setMutatingOrderItemId(null);
}, [closeAuxiliaryOrderModals, releaseHeldMesaLock]);
```

**Acción adicional**: Renombrar los aliases del hook:
- `hookCloseOrderModal` → `closeOrderModal`
- `hookCloseAuxiliaryOrderModals` → `closeAuxiliaryOrderModals`

**Verificación**: Compilar y probar en dispositivo.

---

## Verificación Final

### 1. Compilación
```bash
curl -s "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false" > /dev/null 2>&1 && echo "✅ Compila" || echo "❌ Error"
```

### 2. Build APK
```bash
cd apps/mobile/android && ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew assembleDebug
```

### 3. Test en Dispositivo
```bash
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell monkey -p com.stocky.mobile -c android.intent.category.LAUNCHER 1
```

### 4. Verificar Funcionalidad
- [ ] App abre correctamente
- [ ] Se pueden ver las mesas
- [ ] Se puede abrir una mesa
- [ ] Se puede agregar productos a una orden
- [ ] Se puede cerrar una mesa
- [ ] Los locks funcionan (probar con 2 dispositivos si es posible)

## Rollback Plan

Si algún paso falla:
```bash
git checkout HEAD -- apps/mobile/src/features/mesas/MesasPanel.tsx
```

## Resultados Esperados

- **Líneas eliminadas**: ~196 líneas
- **Líneas agregadas**: ~35 líneas (import + hook call)
- **Reducción neta**: ~161 líneas
- **MesasPanel.tsx final**: ~5,592 líneas

## Notas Importantes

1. **Orden de eliminación**: Es CRÍTICO seguir el orden exacto (refreshMesaLocks → publishMesaLockBroadcast → releaseHeldMesaLock → acquireMesaLockForEdition → closeAuxiliaryOrderModals → closeOrderModal) porque las funciones tienen dependencias entre sí.

2. **Aliases temporales**: Usamos `hookCloseOrderModal` y `hookCloseAuxiliaryOrderModals` para evitar conflictos durante la transición.

3. **Verificación después de cada paso**: Compilar después de CADA eliminación para detectar errores inmediatamente.

4. **No usar scripts**: Hacer las eliminaciones manualmente con el editor para evitar errores de bracket matching.

5. **El hook ya está probado**: useMesaEditLock.ts compila y funciona correctamente. El problema es solo la integración.
