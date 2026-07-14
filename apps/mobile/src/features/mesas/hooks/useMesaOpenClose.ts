import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import {
  openCloseMesa,
  type BusinessContext,
  type MesaRecord,
} from '../../../services/mesasService';
import type { MesaOrderItem } from '../../../services/mesaOrderService';
import { compareMesaTableIdentifiers } from '../utils/mesaHelpers';

type UseMesaOpenCloseParams = {
  session: Session;
  context: BusinessContext | null | undefined;
  selectedMesa: MesaRecord | null;
  setSelectedMesa: (v: MesaRecord | null) => void;
  setMesas: (v: MesaRecord[] | ((prev: MesaRecord[]) => MesaRecord[])) => void;
  setOrderItems: (v: MesaOrderItem[]) => void;
  setLoadingOrder: (v: boolean) => void;
  setOrderModalError: (v: string | null) => void;
  setShowOrderModal: (v: boolean) => void;
  setError: (v: string | null) => void;
  setActingMesaId: (v: string | null | ((prev: string | null) => string | null)) => void;
  setActiveOrderId: (v: string | null) => void;
  closeOrderModal: () => void;
  openOrderModal: (mesa: MesaRecord, options?: Record<string, unknown>) => void;
  acquireMesaLockForEdition: (mesa: MesaRecord) => Promise<boolean>;
  ensureCatalogLoaded: (businessId: string, options?: { forceRefresh?: boolean }) => Promise<unknown[]>;
  publishMesaStateBroadcast: (mesa: MesaRecord, options?: Record<string, unknown>) => void;
  bumpMesaActionVersion: (mesaId: string) => number;
  isMesaActionVersionCurrent: (mesaId: string, version: number) => boolean;
  orderItemsCacheRef: React.MutableRefObject<Map<string, MesaOrderItem[]>>;
  orderModalOpenIntentRef: React.MutableRefObject<boolean>;
};

export function useMesaOpenClose({
  session,
  context,
  selectedMesa,
  setSelectedMesa,
  setMesas,
  setOrderItems,
  setLoadingOrder,
  setOrderModalError,
  setShowOrderModal,
  setError,
  setActingMesaId,
  setActiveOrderId,
  closeOrderModal,
  openOrderModal,
  acquireMesaLockForEdition,
  ensureCatalogLoaded,
  publishMesaStateBroadcast,
  bumpMesaActionVersion,
  isMesaActionVersionCurrent,
  orderItemsCacheRef,
  orderModalOpenIntentRef,
}: UseMesaOpenCloseParams) {
  const { t } = useTranslation('mesas');

  const handleOpenClose = useCallback(
    async (mesa: MesaRecord, action: 'open' | 'close') => {
      if (!session.access_token) {
        setError(t('mesas.noSession'));
        return;
      }

      setActingMesaId(mesa.id);
      if (action === 'open') {
        orderModalOpenIntentRef.current = true;
      }
      setError(null);
      const previousOrderId = String(mesa.current_order_id || '').trim() || null;
      const actionVersion = bumpMesaActionVersion(mesa.id);

      const optimisticMesa: MesaRecord =
        action === 'open'
          ? {
              ...mesa,
              status: 'occupied',
              orders: {
                ...(mesa.orders || {}),
                status: 'open',
              },
            }
          : {
              ...mesa,
              status: 'available',
              current_order_id: null,
              orders: null,
            };

      publishMesaStateBroadcast(optimisticMesa, {
        previousOrderId,
        mode: 'optimistic',
      });

      if (action === 'open') {
        setSelectedMesa({
          ...mesa,
          status: 'occupied',
        });
        setOrderItems([]);
        setOrderModalError(null);
        setLoadingOrder(true);
        setShowOrderModal(true);
      }

      try {
        if (action === 'open') {
          const [lockAcquired, updatedMesa] = await Promise.all([
            acquireMesaLockForEdition(mesa),
            openCloseMesa({
              accessToken: session.access_token,
              userId: session.user.id,
              tableId: mesa.id,
              action,
            }),
            ...(context?.businessId
              ? [ensureCatalogLoaded(context.businessId, { forceRefresh: true }).catch(() => [])]
              : []),
          ]);

          if (!isMesaActionVersionCurrent(mesa.id, actionVersion)) {
            return;
          }

          const mergedMesa: MesaRecord = {
            ...mesa,
            ...updatedMesa,
            table_number: updatedMesa.table_number ?? mesa.table_number,
            table_name: updatedMesa.table_name ?? mesa.table_name,
            orders: {
              ...(mesa.orders || {}),
              ...(updatedMesa.orders || {}),
            },
          };

          if (!lockAcquired) {
            publishMesaStateBroadcast(mesa, {
              previousOrderId,
              mode: 'rollback',
            });
            closeOrderModal();
            setActingMesaId(null);
            return;
          }

          setMesas((prev) =>
            prev
              .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
              .sort(compareMesaTableIdentifiers),
          );
          publishMesaStateBroadcast(mergedMesa, {
            previousOrderId,
            mode: 'confirmed',
          });

          if (mergedMesa.current_order_id) {
            const openedOrderId = String(mergedMesa.current_order_id || '').trim();
            if (openedOrderId) {
              orderItemsCacheRef.current.set(openedOrderId, []);
              setActiveOrderId(openedOrderId);
            }
            if (orderModalOpenIntentRef.current) {
              void openOrderModal(mergedMesa, {
                skipOrderItemsFetch: true,
                initialItems: [],
                skipLockAcquire: true,
              });
            }
          } else {
            closeOrderModal();
            setError(t('mesas.orderNotFound'));
          }
        } else {
          const updatedMesa = await openCloseMesa({
            accessToken: session.access_token,
            userId: session.user.id,
            tableId: mesa.id,
            action,
          });

          if (!isMesaActionVersionCurrent(mesa.id, actionVersion)) {
            return;
          }

          const mergedMesa: MesaRecord = {
            ...mesa,
            ...updatedMesa,
            table_number: updatedMesa.table_number ?? mesa.table_number,
            table_name: updatedMesa.table_name ?? mesa.table_name,
            orders: {
              ...(mesa.orders || {}),
              ...(updatedMesa.orders || {}),
            },
          };

          setMesas((prev) =>
            prev
              .map((row) => (row.id === mergedMesa.id ? mergedMesa : row))
              .sort(compareMesaTableIdentifiers),
          );
          publishMesaStateBroadcast(mergedMesa, {
            previousOrderId,
            mode: 'confirmed',
          });

          if (selectedMesa?.id === mergedMesa.id) {
            closeOrderModal();
          }
        }
      } catch (err) {
        if (action === 'open') {
          closeOrderModal();
        }
        publishMesaStateBroadcast(mesa, {
          previousOrderId,
          mode: 'rollback',
        });
        setError(err instanceof Error ? err.message : t('mesas.updateFailed'));
      } finally {
        setActingMesaId((current) => (current === mesa.id ? null : current));
      }
    },
    [
      acquireMesaLockForEdition,
      bumpMesaActionVersion,
      closeOrderModal,
      context,
      ensureCatalogLoaded,
      isMesaActionVersionCurrent,
      openOrderModal,
      orderItemsCacheRef,
      orderModalOpenIntentRef,
      publishMesaStateBroadcast,
      selectedMesa,
      session.access_token,
      session.user.id,
      setLoadingOrder,
      setOrderItems,
      setOrderModalError,
      setSelectedMesa,
      setShowOrderModal,
      setActiveOrderId,
      setActingMesaId,
      setError,
      setMesas,
      t,
    ],
  );

  return { handleOpenClose };
}
