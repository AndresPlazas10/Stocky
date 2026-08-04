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
} from './types';

export {
  getOrderItemName,
  calculateOrderTotal,
  sumOrderItemsQuantity,
  normalizeOrderReference,
  normalizeOrderItemQuantity,
  normalizeOrderItemSubtotal,
  reconcileOrderItemsFromServer,
  calculateCashChange,
} from './utils';

export {
  invalidateCatalogItemsCache,
  listProductsForMesaOrder,
  listCombosForMesaOrder,
  listCatalogItems,
} from './catalogService';

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
} from './itemService';

export {
  buildCatalogLookup,
  evaluateOrderStockShortages,
  evaluateOrderStockShortagesWithLookup,
} from './stockService';
