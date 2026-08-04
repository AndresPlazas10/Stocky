import { useState, useCallback, useMemo } from 'react';

export function usePurchaseCart() {
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        code: product.code || '',
        quantity: 1,
        unit_price: Number(product.purchase_price || product.cost || 0),
        manage_stock: product.manage_stock !== false,
        stock: Number(product.stock || 0),
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, newQuantity: number | string) => {
    const qty = Math.max(0, Number(newQuantity) || 0);
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, quantity: qty } : item))
    );
  }, [removeFromCart]);

  const updatePrice = useCallback((productId: string, newPrice: number | string) => {
    const price = Math.max(0, Number(newPrice) || 0);
    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, unit_price: price } : item))
    );
  }, []);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);

  const resetForm = useCallback(() => {
    setSupplierId('');
    setPaymentMethod('cash');
    setNotes('');
    setCart([]);
  }, []);

  return {
    supplierId, setSupplierId,
    paymentMethod, setPaymentMethod,
    notes, setNotes,
    cart, setCart,
    addToCart, removeFromCart, updateQuantity, updatePrice,
    total,
    resetForm,
  };
}
