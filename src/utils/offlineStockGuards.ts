const SALE_ITEM_TYPE = {
  PRODUCT: 'product',
  COMBO: 'combo'
};

const toPositiveNumber = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
};

export const buildCartConsumptionByProduct = ({ cart = [], comboById = new Map() }) => {
  const consumptionByProduct = new Map();

  (Array.isArray(cart) ? cart : []).forEach((item) => {
    const itemType = item?.item_type || (item?.combo_id ? SALE_ITEM_TYPE.COMBO : SALE_ITEM_TYPE.PRODUCT);

    if (itemType === SALE_ITEM_TYPE.PRODUCT && item?.product_id) {
      const quantity = toPositiveNumber(item?.quantity);
      if (!quantity) return;
      const current = Number(consumptionByProduct.get(item.product_id) || 0);
      consumptionByProduct.set(item.product_id, current + quantity);
      return;
    }

    if (itemType === SALE_ITEM_TYPE.COMBO && item?.combo_id) {
      const combo = comboById instanceof Map ? comboById.get(item.combo_id) : null;
      if (!combo) return;

      const comboQuantity = toPositiveNumber(item?.quantity);
      if (!comboQuantity) return;

      (Array.isArray(combo.combo_items) ? combo.combo_items : []).forEach((component) => {
        const productId = component?.producto_id;
        if (!productId) return;

        const componentQty = toPositiveNumber(component?.cantidad);
        if (!componentQty) return;

        const current = Number(consumptionByProduct.get(productId) || 0);
        consumptionByProduct.set(productId, current + (comboQuantity * componentQty));
      });
    }
  });

  return consumptionByProduct;
};

export const applyOfflineStockConsumption = ({ products = [], consumptionByProduct = new Map() }) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeConsumption = consumptionByProduct instanceof Map ? consumptionByProduct : new Map();

  return safeProducts.map((product) => {
    const consumeQty = Number(safeConsumption.get(product?.id) || 0);
    if (!consumeQty || product?.manage_stock === false) return product;

    return {
      ...product,
      stock: Math.max(0, Number(product?.stock || 0) - consumeQty)
    };
  });
};

export const evaluateOfflineStockShortages = ({ cart = [], products = [], comboById = new Map() }) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const stockByProductId = new Map();
  const manageStockByProductId = new Map();
  const productById = new Map();

  safeProducts.forEach((product) => {
    productById.set(product.id, product);
    stockByProductId.set(product.id, Number(product?.stock ?? 0));
    manageStockByProductId.set(product.id, product?.manage_stock !== false);
  });

  const comboRequiredByProduct = new Map();
  const safeCart = Array.isArray(cart) ? cart : [];

  safeCart.forEach((item) => {
    const itemType = item?.item_type || (item?.combo_id ? SALE_ITEM_TYPE.COMBO : SALE_ITEM_TYPE.PRODUCT);
    if (itemType !== SALE_ITEM_TYPE.COMBO || !item?.combo_id) return;

    const combo = comboById instanceof Map ? comboById.get(item.combo_id) : null;
    if (!combo) return;

    const comboQuantity = toPositiveNumber(item?.quantity);
    if (!comboQuantity) return;

    (Array.isArray(combo.combo_items) ? combo.combo_items : []).forEach((component) => {
      const productId = component?.producto_id;
      if (!productId) return;

      const componentQty = toPositiveNumber(component?.cantidad);
      if (!componentQty) return;

      const current = Number(comboRequiredByProduct.get(productId) || 0);
      comboRequiredByProduct.set(productId, current + (comboQuantity * componentQty));
    });
  });

  const comboShortages = [];
  comboRequiredByProduct.forEach((requiredQty, productId) => {
    const shouldManageStock = manageStockByProductId.get(productId) !== false;
    if (!shouldManageStock) return;

    const stock = Number(stockByProductId.get(productId) || 0);
    if (stock >= requiredQty) return;

    const product = productById.get(productId);
    comboShortages.push({
      product_id: productId,
      product_name: product?.name || 'Producto',
      available_stock: stock,
      required_quantity: requiredQty
    });
  });

  const simpleShortages = safeCart
    .filter((item) => {
      const itemType = item?.item_type || (item?.combo_id ? SALE_ITEM_TYPE.COMBO : SALE_ITEM_TYPE.PRODUCT);
      return itemType === SALE_ITEM_TYPE.PRODUCT && item?.product_id && item?.manage_stock !== false;
    })
    .map((item) => {
      const liveStock = stockByProductId.get(item.product_id);
      const baseAvailableStock = Number.isFinite(liveStock) ? Number(liveStock) : Number(item?.available_stock || 0);
      const reservedByCombos = Number(comboRequiredByProduct.get(item.product_id) || 0);
      const availableStock = Math.max(0, baseAvailableStock - reservedByCombos);
      const requiredQty = toPositiveNumber(item?.quantity);
      if (availableStock >= requiredQty) return null;

      return {
        product_id: item.product_id,
        product_name: item?.name || 'Producto',
        available_stock: availableStock,
        required_quantity: requiredQty
      };
    })
    .filter(Boolean);

  return {
    comboStockShortages: comboShortages,
    simpleStockShortages: simpleShortages
  };
};
