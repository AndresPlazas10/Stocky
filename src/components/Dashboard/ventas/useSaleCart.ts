import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SALE_ITEM_TYPE, buildCartItemKey } from './ventasConstants';
import { evaluateOfflineStockShortages } from '../../../utils/offlineStockGuards';

export function useSaleCart(products: any[], comboById: Map<string, any>, businessId: string) {
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchProduct, setSearchProduct] = useState('');
  const [saleModalPanel, setSaleModalPanel] = useState('catalog');
  const saleIntentKeyRef = useRef<string | null>(null);
  const saleIntentSignatureRef = useRef('');

  const addToCart = useCallback((catalogItem: any) => {
    const itemType = catalogItem?.item_type || SALE_ITEM_TYPE.PRODUCT;
    const itemId = catalogItem?.item_id || catalogItem?.id;
    if (!itemId) return;

    const itemKey = buildCartItemKey(itemType, itemId);

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.item_key === itemKey);

      if (existingItem) {
        return prevCart.map((item) => (
          item.item_key === itemKey
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        ));
      }

      const unitPrice = Number(catalogItem.sale_price || 0);
      const quantity = 1;
      return [
        ...prevCart,
        {
          item_key: itemKey,
          item_type: itemType,
          item_id: itemId,
          product_id: itemType === SALE_ITEM_TYPE.PRODUCT ? itemId : null,
          combo_id: itemType === SALE_ITEM_TYPE.COMBO ? itemId : null,
          name: catalogItem.name,
          code: catalogItem.code || '',
          quantity,
          unit_price: unitPrice,
          subtotal: quantity * unitPrice,
          available_stock: itemType === SALE_ITEM_TYPE.PRODUCT && catalogItem.manage_stock !== false
            ? Number(catalogItem.stock || 0)
            : null,
          manage_stock: itemType === SALE_ITEM_TYPE.PRODUCT ? catalogItem.manage_stock !== false : true
        }
      ];
    });
    setSearchProduct('');
  }, []);

  const removeFromCart = useCallback((itemKey: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.item_key !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemKey);
      return;
    }

    setCart((prevCart) => prevCart.map((item) => (
      item.item_key === itemKey
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.unit_price }
        : item
    )));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer('');
    setPaymentMethod('cash');
    setSearchProduct('');
    setSaleModalPanel('catalog');
    saleIntentKeyRef.current = null;
    saleIntentSignatureRef.current = '';
  }, []);

  const { comboStockShortages, simpleStockShortages } = useMemo(
    () => evaluateOfflineStockShortages({ cart, products, comboById }),
    [cart, products, comboById]
  );

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const saleIntentSignature = useMemo(() => {
    const normalizedItems = [...cart]
      .map((item) => ({
        item_type: item.item_type || SALE_ITEM_TYPE.PRODUCT,
        product_id: item.product_id || null,
        combo_id: item.combo_id || null,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }))
      .sort((a, b) => String(a.product_id || a.combo_id || '').localeCompare(String(b.product_id || b.combo_id || '')));

    return JSON.stringify({
      businessId,
      paymentMethod,
      items: normalizedItems
    });
  }, [businessId, paymentMethod, cart]);

  useEffect(() => {
    if (cart.length === 0) {
      saleIntentKeyRef.current = null;
      saleIntentSignatureRef.current = '';
    }
  }, [cart.length]);

  return {
    cart, setCart,
    selectedCustomer, setSelectedCustomer,
    paymentMethod, setPaymentMethod,
    searchProduct, setSearchProduct,
    saleModalPanel, setSaleModalPanel,
    addToCart, removeFromCart, updateQuantity, clearCart,
    comboStockShortages, simpleStockShortages,
    total,
    saleIntentSignature, saleIntentKeyRef, saleIntentSignatureRef,
  };
}
