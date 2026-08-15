import { useCallback, useEffect, useRef, useState } from 'react';
import { loadOpenOrderSnapshot, type MesaOrderItem } from '../../../services/mesaOrderService';
import { setTableCallRequested, type MesaRecord } from '../../../services/mesasService';
import { isMesaOccupied } from '../utils/mesaHelpers';
import { buildOrderSignature } from '../utils/orderSignature';

type UseKitchenOrdersParams = {
  mesas: MesaRecord[];
  enabled: boolean;
  businessId?: string | null;
  onCall?: (mesa: MesaRecord) => void;
  onOrderChanged?: (kind: 'new' | 'update', orderId: string, mesa: MesaRecord) => void;
};

const POLL_INTERVAL_MS = 15000;
const CALL_PULSE_MS = 4000;
const FORCE_RELOAD_THROTTLE_MS = 2000;

export function useKitchenOrders({
  mesas,
  enabled,
  businessId,
  onCall,
  onOrderChanged,
}: UseKitchenOrdersParams) {
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, MesaOrderItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [callingOrderIds, setCallingOrderIds] = useState<Set<string>>(new Set());
  const [mostRecentOrderId, setMostRecentOrderId] = useState<string | null>(null);
  const loadedSignatureRef = useRef('');
  const lastForceLoadRef = useRef(0);
  const baselineDoneRef = useRef(false);
  const knownSignaturesRef = useRef<Map<string, string>>(new Map());
  const arrivalTimestampsRef = useRef<Map<string, number>>(new Map());
  const callTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const onOrderChangedRef = useRef(onOrderChanged);
  onOrderChangedRef.current = onOrderChanged;

  const loadItems = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const openOrders = (Array.isArray(mesas) ? mesas : [])
        .filter((mesa) => {
          if (!isMesaOccupied(mesa.status) || !mesa.current_order_id) return false;
          const orderStatus = String(mesa.orders?.status || '').trim().toLowerCase();
          return orderStatus !== 'closed';
        })
        .map((mesa) => String(mesa.current_order_id).trim());
      const signature = openOrders.sort().join(',');

      if (!force && loadedSignatureRef.current === signature) return;
      if (force && Date.now() - lastForceLoadRef.current < FORCE_RELOAD_THROTTLE_MS) return;
      if (force) lastForceLoadRef.current = Date.now();
      loadedSignatureRef.current = signature;

      setLoadingItems(true);
      try {
        const results = await Promise.all(
          openOrders.map(async (orderId) => {
            try {
              const snapshot = await loadOpenOrderSnapshot(orderId, { forceRefresh: true });
              return [orderId, snapshot.items] as const;
            } catch {
              return [orderId, [] as MesaOrderItem[]] as const;
            }
          }),
        );
        const itemsMap = Object.fromEntries(results);
        setItemsByOrderId(itemsMap);

        const findMesaForOrder = (orderId: string): MesaRecord | undefined =>
          (Array.isArray(mesas) ? mesas : []).find(
            (m) => String(m.current_order_id || '').trim() === orderId,
          );

        // Primera carga: sembrar las firmas de las órdenes existentes y sus
        // timestamps de recencia desde los datos persistidos (updated_at/opened_at),
        // para que el orden "más reciente primero" sobreviva recargas.
        if (!baselineDoneRef.current) {
          baselineDoneRef.current = true;
          openOrders.forEach((orderId) => {
            const mesa = findMesaForOrder(orderId);
            knownSignaturesRef.current.set(
              orderId,
              buildOrderSignature(itemsMap[orderId] ?? [], mesa?.orders?.notes || ''),
            );
            const persistedTs = Date.parse(
              String(mesa?.orders?.updated_at || mesa?.orders?.opened_at || ''),
            );
            if (Number.isFinite(persistedTs) && !arrivalTimestampsRef.current.has(orderId)) {
              arrivalTimestampsRef.current.set(orderId, persistedTs);
            }
          });
          return;
        }

        // Cargas siguientes: sonar cuando la firma de una orden difiere de la conocida.
        // Cubre: orden nueva, cantidad ↑/↓, producto agregado/eliminado y comentario.
        Object.entries(itemsMap).forEach(([orderId, items]) => {
          const mesa = findMesaForOrder(orderId);
          const orderStatus = String(mesa?.orders?.status || '').trim().toLowerCase();
          const nextSignature = buildOrderSignature(items, mesa?.orders?.notes || '');
          const prevSignature = knownSignaturesRef.current.get(orderId);
          knownSignaturesRef.current.set(orderId, nextSignature);

          // Cierre de orden: la mesa pasa a disponible, no hay nada que preparar.
          if (orderStatus === 'closed') return;

          if (prevSignature === undefined || prevSignature === '') {
            if (nextSignature === '') return;
            arrivalTimestampsRef.current.set(orderId, Date.now());
            if (mesa) onOrderChangedRef.current?.('new', orderId, mesa);
            return;
          }

          if (prevSignature !== nextSignature && mesa) {
            arrivalTimestampsRef.current.set(orderId, Date.now());
            onOrderChangedRef.current?.('update', orderId, mesa);
          }
        });

        // Limpiar firmas de órdenes que ya no están abiertas.
        const activeOrderIds = new Set(openOrders);
        knownSignaturesRef.current.forEach((_, orderId) => {
          if (!activeOrderIds.has(orderId)) knownSignaturesRef.current.delete(orderId);
        });
        arrivalTimestampsRef.current.forEach((_, orderId) => {
          if (!activeOrderIds.has(orderId)) arrivalTimestampsRef.current.delete(orderId);
        });

        // El pedido con la llegada más reciente = "Pedido más reciente" en cocina.
        let latestOrderId: string | null = null;
        let latestTs = -Infinity;
        arrivalTimestampsRef.current.forEach((ts, orderId) => {
          if (ts > latestTs) {
            latestTs = ts;
            latestOrderId = orderId;
          }
        });
        setMostRecentOrderId((prev) => (prev === latestOrderId ? prev : latestOrderId));
      } finally {
        setLoadingItems(false);
      }
    },
    [enabled, mesas],
  );

  useEffect(() => {
    void loadItems(true);
  }, [loadItems]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void loadItems(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, loadItems]);

  useEffect(() => {
    return () => {
      callTimersRef.current.forEach((timer) => clearTimeout(timer));
      callTimersRef.current.clear();
    };
  }, []);

  const handleCallMesa = useCallback(
    (mesa: MesaRecord) => {
      const orderId = String(mesa.current_order_id || '').trim();
      if (!orderId) return;

      onCall?.(mesa);

      if (businessId && mesa.id) {
        setTableCallRequested(mesa.id, businessId).catch(() => {
          // El feedback visual local permanece aunque falle la persistencia.
        });
      }

      setCallingOrderIds((prev) => {
        if (prev.has(orderId)) return prev;
        return new Set(prev).add(orderId);
      });

      const existing = callTimersRef.current.get(orderId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setCallingOrderIds((prev) => {
          if (!prev.has(orderId)) return prev;
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        callTimersRef.current.delete(orderId);
      }, CALL_PULSE_MS);
      callTimersRef.current.set(orderId, timer);
    },
    [onCall, businessId],
  );

  return {
    itemsByOrderId,
    loadingItems,
    callingOrderIds,
    mostRecentOrderId,
    orderArrivalTsByOrderId: arrivalTimestampsRef,
    handleCallMesa,
  };
}

export type UseKitchenOrdersReturn = ReturnType<typeof useKitchenOrders>;
