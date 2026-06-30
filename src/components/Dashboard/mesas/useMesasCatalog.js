import { useMemo } from 'react';
import { useProgressiveList } from '../../../hooks/useProgressiveList.js';
import { normalizeEntityId, calculateOrderItemsTotal, ORDER_ITEM_TYPE } from './mesaHelpers.js';
import { calcularCambio } from '../../../utils/cambio.js';

export function useMesasCatalog({
  products,
  combos,
  orderItems,
  selectedMesa,
  searchProduct,
  debouncedSearch,
  lowMotionMode,
  paymentMethod,
  amountReceived,
}) {
  const comboById = useMemo(() => {
    const map = new Map();
    combos.forEach((combo) => map.set(combo.id, combo));
    return map;
  }, [combos]);

  const catalogItems = useMemo(() => {
    const productItems = products.map((product) => ({
      item_type: ORDER_ITEM_TYPE.PRODUCT,
      id: product.id,
      product_id: product.id,
      combo_id: null,
      name: product.name,
      code: product.code || '',
      sale_price: Number(product.sale_price || 0),
      stock: Number(product.stock || 0),
      manage_stock: product.manage_stock !== false,
    }));
    const comboItems = combos.map((combo) => ({
      item_type: ORDER_ITEM_TYPE.COMBO,
      id: combo.id,
      product_id: null,
      combo_id: combo.id,
      name: combo.nombre,
      code: `COMBO-${String(combo.id).slice(0, 4).toUpperCase()}`,
      sale_price: Number(combo.precio_venta || 0),
      stock: null,
      combo_items: combo.combo_items || [],
    }));
    return [...comboItems, ...productItems];
  }, [products, combos]);

  const filteredCatalog = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const search = debouncedSearch.toLowerCase();
    return catalogItems.filter(
      (item) => item.name.toLowerCase().includes(search) || item.code.toLowerCase().includes(search),
    );
  }, [debouncedSearch, catalogItems]);

  const {
    visibleItems: visibleFilteredCatalog,
    hasMore: hasMoreFilteredCatalog,
    totalCount: totalFilteredCatalog,
    sentinelRef: filteredCatalogSentinelRef,
    loadMore: loadMoreFilteredCatalog,
  } = useProgressiveList(filteredCatalog, {
    initialCount: lowMotionMode ? 8 : 12,
    step: lowMotionMode ? 8 : 12,
    rootMargin: '220px',
    resetKey: `${searchProduct.trim().toLowerCase()}:${filteredCatalog.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const {
    visibleItems: visibleOrderItems,
    hasMore: hasMoreOrderItems,
    totalCount: totalOrderItems,
    sentinelRef: orderItemsSentinelRef,
    loadMore: loadMoreOrderItems,
  } = useProgressiveList(orderItems, {
    initialCount: lowMotionMode ? 10 : 16,
    step: lowMotionMode ? 8 : 14,
    rootMargin: '240px',
    resetKey: `${selectedMesa?.id || 'none'}:${orderItems.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const orderTotal = useMemo(() => calculateOrderItemsTotal(orderItems), [orderItems]);

  const cambioPago = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (amountReceived === '' || amountReceived === null) {
      return { isValid: false, reason: 'empty', change: 0, breakdown: [] };
    }
    return calcularCambio(orderTotal, amountReceived);
  }, [paymentMethod, orderTotal, amountReceived]);

  const isCashPaymentInvalid = useMemo(
    () => paymentMethod === 'cash' && amountReceived !== '' && cambioPago && !cambioPago.isValid,
    [paymentMethod, amountReceived, cambioPago],
  );

  const productById = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const productId = normalizeEntityId(product?.id);
      if (productId) map.set(productId, product);
    });
    return map;
  }, [products]);

  const insufficientItems = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    return orderItems
      .filter((item) => !item.combo_id)
      .map((item) => {
        const prod = productById.get(normalizeEntityId(item?.product_id));
        if (!prod || prod.manage_stock === false) return null;
        return prod ? { ...item, available_stock: prod.stock, product_name: prod.name } : null;
      })
      .filter(Boolean)
      .filter((i) => typeof i.available_stock === 'number' && i.quantity > i.available_stock);
  }, [orderItems, productById]);

  const insufficientComboComponents = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    const requiredByProduct = new Map();
    orderItems.forEach((item) => {
      if (!item?.combo_id) return;
      const combo = comboById.get(item.combo_id);
      if (!combo) return;
      const comboQty = Number(item.quantity || 0);
      if (!Number.isFinite(comboQty) || comboQty <= 0) return;
      (combo.combo_items || []).forEach((component) => {
        const productId = component?.producto_id;
        if (!productId) return;
        const componentQty = Number(component?.cantidad || 0);
        if (!Number.isFinite(componentQty) || componentQty <= 0) return;
        const currentRequired = Number(requiredByProduct.get(productId) || 0);
        requiredByProduct.set(productId, currentRequired + comboQty * componentQty);
      });
    });
    const shortages = [];
    requiredByProduct.forEach((requiredQty, productId) => {
      const product = productById.get(normalizeEntityId(productId));
      if (product?.manage_stock === false) return;
      const stock = Number(product?.stock || 0);
      if (stock >= requiredQty) return;
      shortages.push({
        product_id: productId,
        product_name: product?.name || 'Producto',
        available_stock: stock,
        required_quantity: requiredQty,
      });
    });
    return shortages;
  }, [orderItems, comboById, productById]);

  const hasInsufficientComboStock = insufficientComboComponents.length > 0;

  return {
    comboById,
    catalogItems,
    filteredCatalog,
    visibleFilteredCatalog,
    hasMoreFilteredCatalog,
    totalFilteredCatalog,
    filteredCatalogSentinelRef,
    loadMoreFilteredCatalog,
    visibleOrderItems,
    hasMoreOrderItems,
    totalOrderItems,
    orderItemsSentinelRef,
    loadMoreOrderItems,
    orderTotal,
    cambioPago,
    isCashPaymentInvalid,
    productById,
    insufficientItems,
    insufficientComboComponents,
    hasInsufficientComboStock,
  };
}
