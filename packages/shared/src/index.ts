// Roles
export { isAdminRole } from './roles.js';

// Payment Methods
export type { PaymentMethod } from './paymentMethods.js';
export {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  BANK_METHODS,
  isBankPaymentMethod,
  getPaymentMethodLabel
} from './paymentMethods.js';

// Formatters
export type { PriceFormatConfig } from './formatters.js';
export {
  formatPrice,
  formatNumber,
  parsePriceInput,
  parseFormattedNumber
} from './formatters.js';

// Dates
export {
  formatDate,
  formatDateOnly,
  formatTimeOnly,
  formatDateLong,
  formatDateTimeTicket,
  formatTimeCompact,
  formatDateTimeReport
} from './dates.js';

// Change
export type { CashBreakdownEntry, ChangeResult } from './cambio.js';
export {
  COLOMBIAN_DENOMINATIONS,
  parseCopAmount,
  calcularCambio
} from './cambio.js';

// Connectivity
export { isConnectivityError } from './connectivity.js';

// Normalization
export {
  normalizeText,
  normalizeOptionalText,
  normalizeNumber,
  normalizeOptionalAmount,
  normalizeReference
} from './normalization.js';

// Mesa Utilities
export {
  isMesaOccupied,
  normalizeTableIdentifier,
  compareMesaTableIdentifiers,
  resolveMesaSyncVersion,
  mesaDisplayName
} from './mesaUtils.js';

// Order Normalization
export {
  normalizeOrderReference,
  normalizeOrderItemQuantity,
  normalizeOrderItemSubtotal,
  calculateOrderTotal,
  calculateOrderUnits,
  sumOrderItemsQuantity
} from './orderNormalization.js';

// Order Reconciliation
export { reconcileOrderItemsFromServer } from './orderReconciliation.js';
