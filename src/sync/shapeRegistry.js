export const SHAPE_REGISTRY = [
  { key: 'products', table: 'products', priority: 1 },
  { key: 'suppliers', table: 'suppliers', priority: 1 },
  { key: 'customers', table: 'customers', priority: 1 },
  { key: 'sales_recent', table: 'sales', priority: 2 },
  { key: 'sale_details_recent', table: 'sale_details', priority: 2 },
  { key: 'purchases_recent', table: 'purchases', priority: 2 },
  { key: 'purchase_details_recent', table: 'purchase_details', priority: 2 },
  { key: 'orders_open', table: 'orders', priority: 3 },
  { key: 'order_items_open', table: 'order_items', priority: 3 }
];

export function getShapeRegistry() {
  return SHAPE_REGISTRY;
}

