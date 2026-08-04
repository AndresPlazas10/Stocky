import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { useRafBatchedQueue } from '@/hooks/useRafBatchedQueue';
import { logger } from '@/utils/logger';

interface UseVentasRealtimeParams {
  businessId: string;
  setSales: (value: any[] | ((prev: any[]) => any[])) => void;
  setTotalCount: (value: number | ((prev: number) => number)) => void;
  setProducts: (value: any[] | ((prev: any[]) => any[])) => void;
  setCart: (value: any[] | ((prev: any[]) => any[])) => void;
  loadCombos: () => Promise<void>;
  showSuccess: (title: string, message?: string) => void;
  t: (key: string, options?: any) => string;
}

export function useVentasRealtime({
  businessId,
  setSales,
  setTotalCount,
  setProducts,
  setCart,
  loadCombos,
  showSuccess,
  t,
}: UseVentasRealtimeParams) {
  const enqueueRealtimeUpdate = useRafBatchedQueue();

  useRealtimeSubscription('sales', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: (newSale: any) => {
      enqueueRealtimeUpdate(() => {
        const sellerName = typeof newSale?.seller_name === 'string' ? newSale.seller_name.trim() : '';
        const isAdminSeller = sellerName.toLowerCase() === t('roles.admin', { ns: 'common' }).toLowerCase();

        const saleWithDetails = {
          ...newSale,
          employees: isAdminSeller
            ? { full_name: t('roles.admin', { ns: 'common' }), role: 'owner' }
            : { full_name: sellerName || t('ventas:labels.unknownSeller'), role: 'employee' }
        };

        setSales((prev: any[]) => {
          const exists = prev.some((v) => v.id === newSale.id);
          if (exists) return prev;
          return [saleWithDetails, ...prev];
        });

        setTotalCount((prev: number) => prev + 1);
        showSuccess(t('ventas:alerts.saleCreated'));
      });
    },
    onUpdate: (updatedSale: any) => {
      enqueueRealtimeUpdate(() => {
        setSales((prev: any[]) => prev.map((v) => v.id === updatedSale.id ? { ...v, ...updatedSale } : v));
      });
    },
    onDelete: (deletedSale: any) => {
      enqueueRealtimeUpdate(() => {
        setSales((prev: any[]) => prev.filter((v) => v.id !== deletedSale.id));
        setTotalCount((prev: number) => Math.max(0, prev - 1));
      });
    }
  });

  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: (updatedProduct: any) => {
      enqueueRealtimeUpdate(() => {
        setProducts((prev: any[]) => prev.map((p) => p.id === updatedProduct.id ? updatedProduct : p));
        setCart((prevCart: any[]) => prevCart.map((item) =>
          item.product_id === updatedProduct.id
            ? {
                ...item,
                available_stock: updatedProduct.manage_stock === false ? null : updatedProduct.stock,
                manage_stock: updatedProduct.manage_stock !== false
              }
            : item
        ));
      });
    },
    onDelete: (deletedProduct: any) => {
      enqueueRealtimeUpdate(() => {
        setProducts((prev: any[]) => prev.filter((p) => p.id !== deletedProduct.id));
        setCart((prevCart: any[]) => prevCart.map((item) =>
          item.product_id === deletedProduct.id
            ? { ...item, available_stock: 0 }
            : item
        ));
      });
    },
    onInsert: () => {}
  });

  useRealtimeSubscription('combos', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_insert failed', err); });
    },
    onUpdate: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_update failed', err); });
    },
    onDelete: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_delete failed', err); });
    }
  });
}
