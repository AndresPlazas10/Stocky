import { normalizeNumber, normalizeText } from '../../utils/normalization';
import type {
  MesaOrderItem,
  MesaOrderCatalogItem,
  MesaOrderProduct,
  MesaOrderCombo,
  StockShortage,
  ComboComponentShortage,
  CatalogLookup,
} from './types';

export function buildCatalogLookup(catalogItems: MesaOrderCatalogItem[]): CatalogLookup {
  const productById = new Map<string, MesaOrderProduct>();
  const comboById = new Map<string, MesaOrderCombo>();
  const catalog = Array.isArray(catalogItems) ? catalogItems : [];

  catalog.forEach((item) => {
    if (item.item_type === 'product') {
      productById.set(item.product_id, item);
    } else {
      comboById.set(item.combo_id, item);
    }
  });

  return { productById, comboById };
}

export function evaluateOrderStockShortages({
  orderItems,
  catalogItems,
}: {
  orderItems: MesaOrderItem[];
  catalogItems: MesaOrderCatalogItem[];
}): {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
} {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const catalog = Array.isArray(catalogItems) ? catalogItems : [];
  if (items.length === 0 || catalog.length === 0) {
    return {
      insufficientItems: [],
      insufficientComboComponents: [],
    };
  }
  const lookup = buildCatalogLookup(catalog);
  return evaluateOrderStockShortagesWithLookup({ orderItems: items, lookup });
}

export function evaluateOrderStockShortagesWithLookup({
  orderItems,
  lookup,
}: {
  orderItems: MesaOrderItem[];
  lookup: CatalogLookup;
}): {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
} {
  const items = Array.isArray(orderItems) ? orderItems : [];
  if (items.length === 0) {
    return {
      insufficientItems: [],
      insufficientComboComponents: [],
    };
  }

  const productById = lookup.productById;
  const comboById = lookup.comboById;

  const insufficientItems: StockShortage[] = [];

  items
    .filter((item) => item.product_id)
    .forEach((item) => {
      const product = productById.get(String(item.product_id));
      if (!product) return;
      if (product.manage_stock === false) return;

      const requested = normalizeNumber(item.quantity, 0);
      const available = normalizeNumber(product.stock, 0);

      if (requested > available) {
        insufficientItems.push({
          product_id: product.product_id,
          product_name: product.name,
          available_stock: available,
          quantity: requested,
        });
      }
    });

  const requiredByComboComponent = new Map<string, number>();

  items
    .filter((item) => item.combo_id)
    .forEach((item) => {
      const combo = comboById.get(String(item.combo_id));
      if (!combo) return;

      const comboQty = normalizeNumber(item.quantity, 0);
      combo.combo_items.forEach((component) => {
        const productId = normalizeText(component.producto_id);
        if (!productId) return;
        const componentQty = normalizeNumber(component.cantidad, 0);
        const requiredQty = comboQty * componentQty;
        if (requiredQty <= 0) return;

        const prev = requiredByComboComponent.get(productId) || 0;
        requiredByComboComponent.set(productId, prev + requiredQty);
      });
    });

  const insufficientComboComponents: ComboComponentShortage[] = [];
  requiredByComboComponent.forEach((requiredQty, productId) => {
    const product = productById.get(productId);
    const productName = product?.name || 'Producto';
    const available = normalizeNumber(product?.stock, 0);
    const manageStock = product?.manage_stock !== false;

    if (!manageStock) return;

    if (requiredQty > available) {
      insufficientComboComponents.push({
        product_id: productId,
        product_name: productName,
        available_stock: available,
        required_quantity: requiredQty,
      });
    }
  });

  return { insufficientItems, insufficientComboComponents };
}
