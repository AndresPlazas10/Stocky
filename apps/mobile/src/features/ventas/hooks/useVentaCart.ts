import { useCallback, useMemo, useState } from 'react';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';
import type { VentaCartItem } from '../../../services/ventasService';

export function cartReferenceKey(item: { product_id?: string | null; combo_id?: string | null }) {
  if (item.combo_id) return `combo:${item.combo_id}`;
  if (item.product_id) return `product:${item.product_id}`;
  return 'unknown';
}

export function buildCartItem(catalogItem: MesaOrderCatalogItem): VentaCartItem {
  return {
    id: `${catalogItem.item_type}:${catalogItem.id}`,
    item_type: catalogItem.item_type,
    product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
    combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
    name: catalogItem.name,
    code: catalogItem.code,
    manage_stock: catalogItem.manage_stock !== false,
    quantity: 1,
    unit_price: Number(catalogItem.sale_price || 0),
    subtotal: Number(catalogItem.sale_price || 0),
  };
}

export function useVentaCart() {
  const [cart, setCart] = useState<VentaCartItem[]>([]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.subtotal || item.quantity * item.unit_price || 0),
        0,
      ),
    [cart],
  );

  const addToCart = useCallback((catalogItem: MesaOrderCatalogItem) => {
    setCart((prev) => {
      const referenceKey = cartReferenceKey({
        product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
        combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
      });
      const existingIndex = prev.findIndex((row) => cartReferenceKey(row) === referenceKey);
      if (existingIndex < 0) {
        return [...prev, buildCartItem(catalogItem)];
      }

      return prev.map((row, index) => {
        if (index !== existingIndex) return row;
        const nextQuantity = Number(row.quantity || 0) + 1;
        const nextSubtotal = nextQuantity * Number(row.unit_price || 0);
        return {
          ...row,
          quantity: nextQuantity,
          subtotal: nextSubtotal,
        };
      });
    });
  }, []);

  const updateCartQuantity = useCallback((cartItem: VentaCartItem, nextQuantity: number) => {
    setCart((prev) => {
      const key = cartReferenceKey(cartItem);
      if (nextQuantity <= 0) {
        return prev.filter((item) => cartReferenceKey(item) !== key);
      }
      return prev.map((item) => {
        if (cartReferenceKey(item) !== key) return item;
        return {
          ...item,
          quantity: nextQuantity,
          subtotal: nextQuantity * Number(item.unit_price || 0),
        };
      });
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    setCart,
    cartTotal,
    addToCart,
    updateCartQuantity,
    clearCart,
  };
}
