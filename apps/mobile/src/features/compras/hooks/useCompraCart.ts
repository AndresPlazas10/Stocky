import { useCallback, useMemo, useState } from 'react';
import type { CompraCartItem, CompraProductRecord } from '../../../services/comprasService';

export function useCompraCart() {
  const [cart, setCart] = useState<CompraCartItem[]>([]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0),
    [cart],
  );

  const addProductToCart = useCallback((product: CompraProductRecord, supplierId: string, setError: (msg: string | null) => void) => {
    if (!supplierId) {
      setError('Selecciona un proveedor antes de agregar productos.');
      return;
    }
    if (product.supplier_id && product.supplier_id !== supplierId) {
      setError('Ese producto pertenece a otro proveedor.');
      return;
    }
    if (product.manage_stock === false) {
      setError('Este producto no maneja stock y no puede registrarse en compras.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (!existing) {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: Number(product.purchase_price || 0),
            manage_stock: product.manage_stock !== false,
          },
        ];
      }
      return prev.map((item) => (
        item.product_id === product.id
          ? { ...item, quantity: Number(item.quantity || 0) + 1 }
          : item
      ));
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, nextQuantity: number) => {
    setCart((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((item) => item.product_id !== productId);
      }
      return prev.map((item) => (
        item.product_id === productId
          ? { ...item, quantity: nextQuantity }
          : item
      ));
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  return {
    cart,
    setCart,
    cartTotal,
    addProductToCart,
    updateCartQuantity,
    clearCart,
  };
}
