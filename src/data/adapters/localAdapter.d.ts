export interface ReadAdapter {
  subscribeToPostgresChanges(...args: any[]): any;
  removeRealtimeChannel(...args: any[]): any;
  getCurrentUser(): Promise<any>;
  getBusinessById(...args: any[]): Promise<any>;
  getBusinessByOwnerId(...args: any[]): Promise<any>;
  getBusinessByEmail(...args: any[]): Promise<any>;
  getActiveProductsForSale(...args: any[]): Promise<any>;
  getLowStockProductsByBusiness(...args: any[]): Promise<any>;
  getEmployeeByUserAndBusiness(...args: any[]): Promise<any>;
  getSaleDetails(...args: any[]): Promise<any>;
  getSalesByBusinessDateRange(...args: any[]): Promise<any>;
  getPurchasesByBusinessDateRange(...args: any[]): Promise<any>;
  getActiveProductsStockByBusiness(...args: any[]): Promise<any>;
  countSuppliersByBusiness(...args: any[]): Promise<any>;
  countInvoicesByBusinessDateRange(...args: any[]): Promise<any>;
  getSaleDetailsWithProductCostByBusinessDateRange(...args: any[]): Promise<any>;
  getComboSaleDetailsByBusinessDateRange(...args: any[]): Promise<any>;
  getRecentSalesByBusinessSince(...args: any[]): Promise<any>;
  getRecentPurchasesByBusinessSince(...args: any[]): Promise<any>;
  getSaleCashMetadata(...args: any[]): Promise<any>;
  getSaleForPrint(...args: any[]): Promise<any>;
  getBusinessName(...args: any[]): Promise<any>;
  getBusinessesByOwnerId(...args: any[]): Promise<any>;
  getCurrentSession(): Promise<any>;
  getOrdersByBusinessId(...args: any[]): Promise<any>;
  getOrderItemsByOrderId(...args: any[]): Promise<any>;
  getPurchaseDetailsByPurchaseId(...args: any[]): Promise<any>;
  getPurchaseDetailsWithProductByPurchaseId(...args: any[]): Promise<any>;
  getProductsByBusinessAndIds(...args: any[]): Promise<any>;
  getCombosByBusinessWithItems(...args: any[]): Promise<any>;
  getProductPurchasePricesByBusiness(...args: any[]): Promise<any>;
  getSuppliersByBusinessWithSelect(...args: any[]): Promise<any>;
  [key: string]: (...args: any[]) => any;
}

export const readAdapter: ReadAdapter;
export default readAdapter;
