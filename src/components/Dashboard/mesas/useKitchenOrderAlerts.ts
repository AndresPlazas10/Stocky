import { useCallback, useEffect, useRef } from 'react';
import {
  createKitchenAlertCoalescer,
  KITCHEN_ALERT_WINDOW_MS,
  type KitchenAlertKind,
} from '@stocky/shared';
import type { MesaRecord } from '../../../types/components';
import type { TFunction } from 'i18next';

interface KitchenOrderChangedPayload {
  order_id?: string | null;
  id?: string | null;
}

interface UseKitchenOrderAlertsOptions {
  isKitchenRole: boolean;
  mesasRef: React.MutableRefObject<MesaRecord[]>;
  recordOrderArrival: (orderId: string) => void;
  playNewOrderBeep: () => void;
  showInfo: (title: string, message?: string) => void;
  t: TFunction;
}

/**
 * Agrupa los cambios de una misma orden (productos + comentario) en una sola
 * alerta de cocina: editar ítems y guardar el comentario en la misma sesión
 * ya no produce dos toasts ni dos beeps, sino una única notificación con el
 * kind de mayor prioridad (new > update > notes).
 */
export function useKitchenOrderAlerts({
  isKitchenRole,
  mesasRef,
  recordOrderArrival,
  playNewOrderBeep,
  showInfo,
  t,
}: UseKitchenOrderAlertsOptions) {
  const optionsRef = useRef({ isKitchenRole, recordOrderArrival, playNewOrderBeep, showInfo, t });
  optionsRef.current = { isKitchenRole, recordOrderArrival, playNewOrderBeep, showInfo, t };

  const coalescerRef = useRef<ReturnType<typeof createKitchenAlertCoalescer<KitchenOrderChangedPayload>> | null>(null);

  useEffect(() => {
    const coalescer = createKitchenAlertCoalescer<KitchenOrderChangedPayload>({
      windowMs: KITCHEN_ALERT_WINDOW_MS,
      onFlush: (kind, orderId, payload) => {
        const {
          isKitchenRole: isKitchen,
          recordOrderArrival: recordArrival,
          playNewOrderBeep: beep,
          showInfo: showAlert,
          t: translate,
        } = optionsRef.current;
        if (!isKitchen) return;

        const itemRow = (payload || {}) as KitchenOrderChangedPayload;
        const resolvedOrderId = String(itemRow?.order_id || itemRow?.id || '').trim();
        if (!resolvedOrderId) return;

        const mesas = Array.isArray(mesasRef.current) ? mesasRef.current : [];
        const matchingMesa = mesas.find(
          (m) => String((m.orders as unknown as Record<string, unknown>)?.id || '') === resolvedOrderId,
        );

        // No avisar si la orden ya no está activa: cerrada, liberada o sin mesa.
        // En 'new' se tolera que la mesa aún no aparezca en el estado del kitchen
        // (el INSERT del item puede llegar antes del UPDATE de la tabla): se
        // notifica igual y se resuelve la mesa cuando esté disponible.
        if (!matchingMesa) {
          if (kind !== 'new') return;
        } else {
          const mesaOrderStatus = String(
            (matchingMesa?.orders as unknown as Record<string, unknown>)?.status || '',
          ).trim().toLowerCase();
          if (mesaOrderStatus === 'closed') return;
          if (kind !== 'new' && matchingMesa.status !== 'occupied') return;
        }

        beep();
        recordArrival(resolvedOrderId);
        const tableNumber = matchingMesa?.table_number;
        const mesaLabel = tableNumber
          ? translate('mesas:labels.tableNumber', { number: tableNumber })
          : null;
        if (kind === 'new') {
          showAlert(
            translate('mesas:toast.newOrder.title'),
            mesaLabel
              ? translate('mesas:toast.newOrder.message', { mesa: mesaLabel })
              : translate('mesas:toast.newOrder.messageGeneric'),
          );
          return;
        }
        showAlert(
          translate('mesas:toast.updatedOrder.title'),
          mesaLabel
            ? translate('mesas:toast.updatedOrder.message', { mesa: mesaLabel })
            : translate('mesas:toast.updatedOrder.messageGeneric'),
        );
      },
    });
    coalescerRef.current = coalescer;
    return () => {
      // StrictMode (dev) simula desmontar/remontar sin destruir el ref: hay que
      // limpiar el coalescer y volverlo a crear en el remount, o queda
      // permanentemente "disposed" y la cocina deja de recibir alertas.
      coalescer.flushPending();
      coalescer.dispose();
      coalescerRef.current = null;
    };
  }, [mesasRef]);

  const handleKitchenOrderChanged = useCallback((kind: KitchenAlertKind, payload: KitchenOrderChangedPayload) => {
    const itemRow = (payload || {}) as KitchenOrderChangedPayload;
    const orderId = String(itemRow?.order_id || itemRow?.id || '').trim();
    if (!orderId) return;
    coalescerRef.current?.notify(kind, orderId, payload);
  }, []);

  return handleKitchenOrderChanged;
}
