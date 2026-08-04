export type {
  MesaOrderProduct,
  MesaOrderCombo,
  MesaOrderCatalogItem,
  MesaOrderItem,
  StockShortage,
  ComboComponentShortage,
  CatalogLookup,
  ListCatalogItemsOptions,
  MesaOpenOrderSnapshot,
} from './mesaOrder/types';

export {
  getOrderItemName,
  calculateOrderTotal,
  sumOrderItemsQuantity,
  normalizeOrderReference,
  normalizeOrderItemQuantity,
  normalizeOrderItemSubtotal,
  reconcileOrderItemsFromServer,
  calculateCashChange,
} from './mesaOrder/utils';

export {
  invalidateCatalogItemsCache,
  listProductsForMesaOrder,
  listCombosForMesaOrder,
  listCatalogItems,
} from './mesaOrder/catalogService';

export {
  preloadRpcCompatibility,
  invalidateOrderItemsCache,
  getOrderItemsCacheSnapshot,
  setOrderItemsCacheSnapshot,
  listOrderItems,
  loadOpenOrderSnapshot,
  listOrderItemUnitsByOrderIds,
  syncOrderTotal,
  addCatalogItemToOrder,
  addProductToOrder,
  updateOrderItemQuantityInOrder,
  syncOrderItemQuantity,
  persistOrderSnapshot,
  removeOrderItemFromOrder,
} from './mesaOrder/itemService';

export {
  buildCatalogLookup,
  evaluateOrderStockShortages,
  evaluateOrderStockShortagesWithLookup,
} from './mesaOrder/stockService';
