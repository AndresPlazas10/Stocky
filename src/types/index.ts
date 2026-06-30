// Core domain types
export type { Business, BusinessConfig } from './business';
export type { Product, ProductWithSupplier, ProductCategory } from './product';
export type { Sale, SaleDetail, SaleFilters, SaleCashMetadata, CreateSaleParams, SaleListItem } from './sale';
export type { Order, OrderItem, OrderSnapshot, Table, TableStatus } from './order';
export type { OutboxEvent, OutboxPayload, OutboxStatus, OutboxEventType } from './outbox';
export type { Supplier } from './supplier';
export type { Employee, EmployeeRole } from './employee';
export type { Invoice, InvoiceItem } from './invoice';
export type { Combo, ComboItem } from './combo';
export type { Purchase, PurchaseItem, PurchaseFilters } from './purchase';

// Adapter types
export type { ReadAdapter, WriteAdapter, AdapterResult } from './adapters';

// Config types
export type { LocalSyncConfig, LocalWritesConfig, LocalReadsConfig } from './config';

// UI types
export type { DashboardModule, UserRole } from './ui';

// Component types
export type {
  DashboardModuleProps,
  ModalProps,
  AlertProps,
  AlertDetail,
  StockyButtonProps,
  ButtonVariant,
  ButtonSize,
  BadgeProps,
  BadgeVariant,
  StockyInputProps,
  StockySelectProps,
  StockyTextareaProps,
  StockyCardProps,
  LoadingSpinnerProps,
  LoadingPageProps,
  LoadingSkeletonProps,
  ErrorMessageProps,
  ErrorPageProps,
  EmptyStateProps,
  ModernAlertProps,
  ModernAlertType,
  ModernModalProps,
  ModernButtonProps,
  ModernInputProps,
  StatCardProps,
  ModernTableColumn,
  ModernTableProps,
  ProductCardProps,
  ProductFormData,
  ProductFormModalProps,
  MesaRecord,
  MesaHeaderProps,
  AddMesaFormProps,
  CloseOrderChoiceModalProps,
  InventoryGridProps,
  InventoryHeaderProps,
  DeleteConfirmModalProps,
  DeactivateConfirmModalProps,
} from './components';
