import type { Business } from './business';
import type { Product, ProductWithSupplier } from './product';
import type { Sale, SaleDetail, SaleCashMetadata, SaleListItem } from './sale';
import type { Order, OrderItem } from './order';
import type { Supplier } from './supplier';
import type { Employee } from './employee';
import type { Invoice, InvoiceItem } from './invoice';
import type { Combo, ComboItem } from './combo';
import type { Purchase, PurchaseItem } from './purchase';
import type { Table } from './order';

export interface AdapterResult<T> {
  data: T | null;
  error: Error | null;
  count?: number;
}

export interface ReadAdapter {
  // Products
  getActiveProductsForSale(businessId: string): Promise<AdapterResult<ProductWithSupplier[]>>;
  getProductsWithSupplierByBusiness(businessId: string, options?: {
    activeOnly?: boolean;
    includeInactive?: boolean;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<AdapterResult<ProductWithSupplier[]>>;
  getProductById(productId: string): Promise<AdapterResult<Product>>;

  // Sales
  getSaleDetails(saleId: string): Promise<AdapterResult<SaleDetail[]>>;
  getSaleCashMetadata(saleId: string): Promise<AdapterResult<SaleCashMetadata>>;
  getSaleForPrint(saleId: string): Promise<AdapterResult<SaleListItem>>;

  // Business
  getBusinessName(businessId: string): Promise<AdapterResult<{ name: string }>>;

  // Tables
  getTablesByBusiness(businessId: string): Promise<AdapterResult<Table[]>>;

  // Orders
  getOrdersByTable(tableId: string): Promise<AdapterResult<Order[]>>;
  getOrderItems(orderId: string): Promise<AdapterResult<OrderItem[]>>;

  // Employees
  getEmployeesByBusiness(businessId: string): Promise<AdapterResult<Employee[]>>;

  // Suppliers
  getSuppliersByBusiness(businessId: string): Promise<AdapterResult<Supplier[]>>;

  // Invoices
  getInvoicesByBusiness(businessId: string): Promise<AdapterResult<Invoice[]>>;
  getInvoiceItems(invoiceId: string): Promise<AdapterResult<InvoiceItem[]>>;

  // Combos
  getCombosByBusiness(businessId: string): Promise<AdapterResult<Combo[]>>;
  getComboItems(comboId: string): Promise<AdapterResult<ComboItem[]>>;

  // Purchases
  getPurchasesByBusiness(businessId: string): Promise<AdapterResult<Purchase[]>>;
  getPurchaseItems(purchaseId: string): Promise<AdapterResult<PurchaseItem[]>>;
}

export interface WriteAdapter {
  // Products
  createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<AdapterResult<Product>>;
  updateProduct(id: string, updates: Partial<Product>): Promise<AdapterResult<Product>>;
  deleteProduct(id: string): Promise<AdapterResult<void>>;

  // Sales
  createSale(sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>): Promise<AdapterResult<Sale>>;

  // Orders
  createOrder(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<AdapterResult<Order>>;
  updateOrder(id: string, updates: Partial<Order>): Promise<AdapterResult<Order>>;

  // Tables
  updateTable(id: string, updates: Partial<Table>): Promise<AdapterResult<Table>>;

  // Employees
  createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<AdapterResult<Employee>>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<AdapterResult<Employee>>;
  deleteEmployee(id: string): Promise<AdapterResult<void>>;

  // Suppliers
  createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<AdapterResult<Supplier>>;
  updateSupplier(id: string, updates: Partial<Supplier>): Promise<AdapterResult<Supplier>>;
  deleteSupplier(id: string): Promise<AdapterResult<void>>;

  // Invoices
  createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<AdapterResult<Invoice>>;

  // Purchases
  createPurchase(purchase: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>): Promise<AdapterResult<Purchase>>;
}
