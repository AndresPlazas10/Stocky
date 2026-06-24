/**
 * Common selectors for Stocky POS E2E tests
 */

// --- Auth Page ---
export const AUTH = {
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  loginButton: 'button:has-text("Iniciar sesion"), button:has-text("Entrar"), button[type="submit"]',
  registerLink: 'a:has-text("Crear cuenta"), a:has-text("Registrate"), a[href*="register"]',
  errorMessage: '[data-testid="error-message"], .text-red-500, [role="alert"]',
  successMessage: '.text-green-500, [role="status"]',
};

// --- Dashboard ---
export const DASHBOARD = {
  container: '[data-testid="dashboard"], main, #root',
  statsCards: '[data-testid="stats-card"], .grid > div',
  salesChart: '[data-testid="sales-chart"], canvas',
  recentActivity: '[data-testid="recent-activity"]',
  navLinks: 'nav a, [role="navigation"] a',
};

// --- Navigation ---
export const NAV = {
  dashboard: 'a[href="/dashboard"], a:has-text("Dashboard")',
  mesas: 'a[href="/mesas"], a:has-text("Mesas")',
  inventory: 'a[href="/inventario"], a:has-text("Inventario")',
  employees: 'a[href="/empleados"], a:has-text("Empleados")',
  settings: 'a[href="/configuracion"], a:has-text("Configuracion")',
  sales: 'a[href="/ventas"], a:has-text("Ventas")',
  pos: 'a[href="/pos"], a:has-text("POS")',
};

// --- Mesas (Tables) ---
export const MESAS = {
  container: '[data-testid="mesas-container"], .grid',
  tableCard: '[data-testid="table-card"], .table-card',
  availableTable: '[data-testid="table-available"], [data-status="available"]',
  occupiedTable: '[data-testid="table-occupied"], [data-status="occupied"]',
  openButton: 'button:has-text("Abrir"), button:has-text("Ocupar")',
  closeButton: 'button:has-text("Cerrar"), button:has-text("Liberar")',
  addTableButton: 'button:has-text("Agregar mesa"), button:has-text("Nueva mesa")',
  tableNameInput: 'input[placeholder*="nombre"], input[name="table_name"]',
  saveButton: 'button:has-text("Guardar")',
  confirmDialog: '[role="dialog"], [data-testid="confirm-dialog"]',
};

// --- POS / Sales ---
export const POS = {
  container: '[data-testid="pos-container"]',
  productGrid: '[data-testid="product-grid"], .product-grid',
  productCard: '[data-testid="product-card"]',
  searchInput: 'input[placeholder*="buscar"], input[placeholder*="Buscar"]',
  cart: '[data-testid="cart"], .cart',
  cartItem: '[data-testid="cart-item"]',
  cartTotal: '[data-testid="cart-total"]',
  addToCartButton: 'button:has-text("Agregar"), button[aria-label*="agregar"]',
  checkoutButton: 'button:has-text("Cobrar"), button:has-text("Pagar")',
  paymentMethodSelect: 'select[name="payment_method"], [data-testid="payment-method"]',
  confirmPaymentButton: 'button:has-text("Confirmar"), button:has-text("Aceptar")',
};

// --- Inventory ---
export const INVENTORY = {
  container: '[data-testid="inventory-container"]',
  productList: '[data-testid="product-list"], table tbody',
  searchInput: 'input[placeholder*="buscar producto"], input[placeholder*="Buscar"]',
  addButton: 'button:has-text("Agregar producto"), button:has-text("Nuevo producto")',
  editButton: 'button:has-text("Editar")',
  deleteButton: 'button:has-text("Eliminar")',
  nameInput: 'input[name="name"], input[placeholder*="nombre"]',
  priceInput: 'input[name="price"], input[placeholder*="precio"]',
  stockInput: 'input[name="stock"], input[placeholder*="stock"]',
  categorySelect: 'select[name="category"]',
  saveButton: 'button:has-text("Guardar")',
  confirmDialog: '[role="dialog"], [data-testid="confirm-dialog"]',
};

// --- Employees ---
export const EMPLOYEES = {
  container: '[data-testid="employees-container"]',
  employeeList: '[data-testid="employee-list"], table tbody',
  addButton: 'button:has-text("Agregar empleado"), button:has-text("Nuevo empleado")',
  editButton: 'button:has-text("Editar")',
  deactivateButton: 'button:has-text("Desactivar")',
  nameInput: 'input[name="name"], input[placeholder*="nombre"]',
  roleSelect: 'select[name="role"]',
  saveButton: 'button:has-text("Guardar")',
};

// --- Settings ---
export const SETTINGS = {
  container: '[data-testid="settings-container"]',
  businessInfoTab: 'button:has-text("Informacion del negocio"), a:has-text("Negocio")',
  notificationsTab: 'button:has-text("Notificaciones"), a:has-text("Notificaciones")',
  saveButton: 'button:has-text("Guardar")',
  businessNameInput: 'input[name="business_name"]',
};

// --- Common ---
export const COMMON = {
  loading: '[data-testid="loading"], .animate-spin, [aria-busy="true"]',
  error: '[role="alert"], .text-red-500',
  success: '[role="status"], .text-green-500',
  modal: '[role="dialog"], [data-testid="modal"]',
  toast: '[data-testid="toast"], .toast',
  offline: '[data-testid="offline-banner"], [data-testid="offline"]',
};
