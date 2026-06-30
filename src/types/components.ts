import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { UserRole } from './ui';
import type { Product, ProductWithSupplier } from './product';
import type { Supplier } from './supplier';

// ── Base Props ──

export interface ClassNameProps {
  className?: string;
}

// ── Dashboard Module Props ──

export interface DashboardModuleProps {
  businessId: string;
  userRole?: UserRole;
}

// ── Modal Props ──

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Alert Props ──

export interface AlertDetail {
  label: string;
  value: string;
}

export interface AlertProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  details?: AlertDetail[];
  duration?: number;
}

// ── Button Props ──

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface StockyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

// ── Badge Props ──

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

// ── Input Props ──

export type StockyInputProps = InputHTMLAttributes<HTMLInputElement>;

// ── Select Props ──

export interface StockySelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: Array<{ value: string; label: string }>;
}

// ── Textarea Props ──

export interface StockyTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

// ── Card Props ──

export type StockyCardProps = HTMLAttributes<HTMLDivElement>;

// ── Loading Props ──

export type LoadingSize = 'sm' | 'md' | 'lg';

export interface LoadingSpinnerProps {
  size?: LoadingSize;
  text?: string;
}

export interface LoadingPageProps {
  text?: string;
}

export interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

// ── Error Props ──

export interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export interface ErrorPageProps {
  code?: string;
  title?: string;
  message?: string;
  showHome?: boolean;
  showBack?: boolean;
}

// ── Empty State Props ──

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  actionLabel?: string;
}

// ── Modern UI Props ──

export type ModernAlertType = 'info' | 'success' | 'warning' | 'error';

export interface ModernAlertProps {
  type?: ModernAlertType;
  title?: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export interface ModernButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export interface ModernInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

// ── Table Props ──

export interface ModernTableColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface ModernTableProps {
  columns: ModernTableColumn[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  loading?: boolean;
  emptyMessage?: string;
}

// ── Product Props ──

export interface ProductCardProps {
  product: ProductWithSupplier;
  index: number;
  lowMotionMode: boolean;
  hasAdminPrivileges: boolean;
  isEmployee: boolean;
  onEdit: (product: ProductWithSupplier) => void;
  onDelete: (productId: string) => void;
  onToggleActive: (productId: string, currentStatus: boolean) => void;
}

export interface ProductFormData {
  name: string;
  category: string;
  purchase_price: string;
  sale_price: string;
  stock: string;
  min_stock: string;
  unit: string;
  supplier_id: string;
  is_active: boolean;
  manage_stock: boolean;
}

export interface ProductFormModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  formData: ProductFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  on_cancel: () => void;
  isSubmitting: boolean;
  generatedCode: string;
  suppliers: Supplier[];
}

// ── Mesa Props ──

export interface MesaRecord {
  id: string;
  table_number: string;
  business_id: string;
  status?: string;
  orders?: unknown[];
}

export interface MesaHeaderProps {
  canManageTables: boolean;
  onToggleAddForm: () => void;
}

export interface AddMesaFormProps {
  showAddForm: boolean;
  canManageTables: boolean;
  isCreatingTable: boolean;
  newTableNumber: string;
  onNewTableNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export interface CloseOrderChoiceModalProps {
  isOpen: boolean;
  orderTotal: number;
  onPayAllTogether: () => void;
  onSplitBill: () => void;
  onClose: () => void;
}

// ── Inventory Grid Props ──

export interface InventoryGridProps {
  visibleProducts: ProductWithSupplier[];
  totalProducts: number;
  canLoadMoreProducts: boolean;
  productsSentinelRef: React.RefObject<HTMLDivElement>;
  loadingMoreProducts: boolean;
  loadMoreProducts: () => void;
  lowMotionMode: boolean;
  hasAdminPrivileges: boolean;
  isEmployee: boolean;
  onEdit: (product: ProductWithSupplier) => void;
  onDelete: (productId: string) => void;
  onToggleActive: (productId: string, currentStatus: boolean) => void;
}

export interface InventoryHeaderProps {
  hasAdminPrivileges: boolean;
  showForm: boolean;
  onToggleForm: () => void;
}

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface DeactivateConfirmModalProps {
  isOpen: boolean;
  deleteCheckResult: {
    has_sales?: boolean;
    has_purchases?: boolean;
    sales_count?: number;
    purchases_count?: number;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface MesasAlertsProps {
  isGeneratingSplitSales: boolean;
  isClosingOrder: boolean;
  success: boolean;
  alertType: string;
  successTitle: string;
  successDetails: AlertDetail[];
  error: string | null;
  showPrintModal: boolean;
  isPrintingReceipt: boolean;
  printCustomerName: string;
  onPrintConfirm: (customerName: string) => void;
  onPrintCancel: () => void;
  onPrintCustomerNameChange: (name: string) => void;
  onSuccessClose: () => void;
  onErrorClose: () => void;
}

export interface CatalogItem {
  item_type: string;
  id: string;
  name: string;
  sale_price?: number;
}

export interface OrderItem {
  id: string;
  combo_id?: string | null;
  price: string;
  subtotal: string;
  quantity: number;
}

export interface OrderDetailsModalProps {
  isOpen: boolean;
  selectedMesa: MesaRecord | null;
  searchProduct: string;
  onSearchChange: (value: string) => void;
  filteredCatalog: CatalogItem[];
  visibleFilteredCatalog: CatalogItem[];
  hasMoreFilteredCatalog: boolean;
  totalFilteredCatalog: number;
  filteredCatalogSentinelRef: React.RefObject<HTMLDivElement>;
  lowMotionMode: boolean;
  onAddItem: (item: CatalogItem) => void;
  onLoadMoreFilteredCatalog: () => void;
  orderItems: OrderItem[];
  visibleOrderItems: OrderItem[];
  hasMoreOrderItems: boolean;
  totalOrderItems: number;
  orderItemsSentinelRef: React.RefObject<HTMLDivElement>;
  isOrderItemsSyncing: boolean;
  getOrderItemRenderKey: (item: OrderItem) => string;
  getOrderItemName: (item: OrderItem) => string;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onLoadMoreOrderItems: () => void;
  orderTotal: number;
  onSave: () => void;
  onPrintKitchen: () => void;
  onCloseOrder: () => void;
  onClose: () => void;
}

export interface InsufficientItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  available_stock: number;
}

export interface InsufficientComboComponent {
  product_id: string;
  product_name: string;
  required_quantity: number;
  available_stock: number;
}

export interface ChangeBreakdown {
  denomination: number;
  count: number;
}

export interface ChangeInfo {
  isValid: boolean;
  reason?: string;
  change: number;
  breakdown: ChangeBreakdown[];
  paid?: number | null;
}

export interface MesaPaymentModalProps {
  isOpen: boolean;
  orderTotal: number;
  cambioPago: ChangeInfo | null;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  selectedCustomer: string;
  onCustomerChange: (customerId: string) => void;
  clientes: Array<{ id: string; full_name: string; email: string }>;
  amountReceived: string;
  onAmountReceivedChange: (value: string) => void;
  amountReceivedError: string;
  setAmountReceivedError: (error: string) => void;
  insufficientItems: InsufficientItem[];
  insufficientComboComponents: InsufficientComboComponent[];
  hasInsufficientComboStock: boolean;
  isCashPaymentInvalid: boolean;
  isClosingOrder: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  calcularCambio: (total: number, received: string) => ChangeInfo;
}

export interface MesaDeleteModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface SplitBillOrderItem {
  id: string;
  product_id?: string;
  products?: { name: string };
  combos?: { nombre?: string; name?: string };
  quantity: number;
  price: string;
  subtotal: string | number;
}

export interface SplitBillSubAccount {
  name: string;
  paymentMethod: string;
  items: SplitBillOrderItem[];
  total: number;
  amountReceived: number | null;
  changeBreakdown: ChangeBreakdown[];
}

export interface SplitBillConfirmData {
  subAccounts: SplitBillSubAccount[];
}

export interface SplitBillModalProps {
  orderItems: SplitBillOrderItem[];
  onConfirm: (data: SplitBillConfirmData) => void;
  onCancel: () => void;
}
