import { useState, useCallback, useMemo } from 'react';

export function useInvoiceForm(showError: (title: string, msg?: string) => void, t: (k: string, o?: any) => string) {
  const [items, setItems] = useState<any[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedCustomer, setSelectedCliente] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true);

  const handleAddProduct = useCallback((producto: any) => {
    if (!producto.stock || producto.stock <= 0) {
      showError('Error', t('facturas:errors.noStock', { name: producto.name }));
      return;
    }
    if (!producto.sale_price || producto.sale_price <= 0) {
      showError('Error', t('facturas:errors.noPrice', { name: producto.name }));
      return;
    }
    setItems((prevItems) => {
      const existing = prevItems.find((item) => item.product_id === producto.id);
      if (existing) {
        if (existing.quantity >= producto.stock) {
          showError('Error', t('facturas:errors.insufficientStock', { stock: producto.stock, name: producto.name }));
          return prevItems;
        }
        return prevItems.map((item) =>
          item.product_id === producto.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price, max_stock: producto.stock }
            : item
        );
      }
      return [...prevItems, { product_id: producto.id, product_name: producto.name, quantity: 1, unit_price: producto.sale_price || 0, total: producto.sale_price || 0, max_stock: producto.stock }];
    });
    setSearchProduct('');
    setShowProductSearch(false);
  }, [showError, t]);

  const handleRemoveItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, newQuantity: any) => {
    setItems((prevItems) => prevItems.map((item) => {
      if (item.product_id !== productId) return item;
      const rawValue = String(newQuantity ?? '').trim();
      if (rawValue === '') return { ...item, quantity: '', total: 0 };
      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue)) return item;
      if (parsedValue <= 0) return { ...item, quantity: '', total: 0 };
      return { ...item, quantity: parsedValue, total: parsedValue * item.unit_price };
    }));
  }, []);

  const totalFactura = useMemo(() => items.reduce((sum: number, item: any) => sum + (item.total || 0), 0), [items]);

  const resetForm = useCallback(() => {
    setItems([]);
    setSearchProduct('');
    setShowProductSearch(false);
    setSelectedCliente('');
    setPaymentMethod('cash');
    setNotes('');
    setSendEmailOnCreate(true);
  }, []);

  return {
    items, setItems,
    searchProduct, setSearchProduct,
    showProductSearch, setShowProductSearch,
    selectedCustomer, setSelectedCliente,
    paymentMethod, setPaymentMethod,
    notes, setNotes,
    sendEmailOnCreate, setSendEmailOnCreate,
    handleAddProduct, handleRemoveItem, updateQuantity,
    totalFactura, resetForm,
  };
}
