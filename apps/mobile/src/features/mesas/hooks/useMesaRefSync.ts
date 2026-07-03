import { useEffect } from 'react';
import type { MesaRecord } from '../../../services/mesasService';

type RealtimeUiTrace = {
  source: 'tables' | 'orders' | 'order_items' | 'mesa_broadcast' | 'mesa_lock';
  eventType: string;
  rowRef: string;
  receivedAt: number;
  commitLagMs: number | null;
};

type OrderItem = Record<string, unknown>;

type CatalogItem = Record<string, unknown>;

type UseMesaRefSyncParams = {
  selectedMesaId: string | undefined;
  mesas: MesaRecord[];
  orderItems: OrderItem[];
  catalogItems: CatalogItem[];
  currentOrderId?: string | undefined;
  pendingUiTraceRef: React.MutableRefObject<RealtimeUiTrace | null>;
  latestOrderItemsRef: React.MutableRefObject<OrderItem[]>;
  catalogItemsRef: React.MutableRefObject<CatalogItem[]>;
  orderItemsCacheRef: React.MutableRefObject<Map<string, OrderItem[]>>;
  selectedMesaIdRef: React.MutableRefObject<string>;
  mesasLengthRef: React.MutableRefObject<number>;
};

export function useMesaRefSync({
  selectedMesaId,
  mesas,
  orderItems,
  catalogItems,
  currentOrderId,
  pendingUiTraceRef,
  latestOrderItemsRef,
  catalogItemsRef,
  orderItemsCacheRef,
  selectedMesaIdRef,
  mesasLengthRef,
}: UseMesaRefSyncParams) {
  useEffect(() => {
    selectedMesaIdRef.current = String(selectedMesaId || '').trim();
  }, [selectedMesaId, selectedMesaIdRef]);

  useEffect(() => {
    mesasLengthRef.current = Array.isArray(mesas) ? mesas.length : 0;
  }, [mesas, mesasLengthRef]);

  useEffect(() => {
    const trace = pendingUiTraceRef.current;
    if (!trace) return;
    const uiLagMs = Math.max(0, Date.now() - trace.receivedAt);
    if (__DEV__) {
      console.warn('[mesa-sync] ui_painted', {
        source: trace.source,
        eventType: trace.eventType,
        rowRef: trace.rowRef,
        commitLagMs: trace.commitLagMs,
        uiLagMs,
      });
    }
    pendingUiTraceRef.current = null;
  }, [mesas, pendingUiTraceRef]);

  useEffect(() => {
    latestOrderItemsRef.current = orderItems;
  }, [latestOrderItemsRef, orderItems]);

  useEffect(() => {
    catalogItemsRef.current = catalogItems;
  }, [catalogItems, catalogItemsRef]);

  useEffect(() => {
    const orderId = String(currentOrderId || '').trim();
    if (!orderId) return;
    orderItemsCacheRef.current.set(orderId, orderItems);
  }, [orderItems, orderItemsCacheRef, currentOrderId]);
}
