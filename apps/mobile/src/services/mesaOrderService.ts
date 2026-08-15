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
  setOrderItemsCacheSnapshot,
  listOrderItems,
  loadOpenOrderSnapshot,
  syncOrderItemQuantity,
  persistOrderSnapshot,
  persistOrderNotes,
} from './mesaOrder/itemService';

export {
  buildCatalogLookup,
  evaluateOrderStockShortages,
  evaluateOrderStockShortagesWithLookup,
} from './mesaOrder/stockService';
