import {
  createVenta,
  deleteVentaWithDetails,
  type VentaCartItem,
} from '../../services/ventasService';
import type { CashChangeEntry, PaymentMethod } from '../../services/mesaCheckoutService';

export async function mutateVentas({
  businessId,
  cartItems,
  paymentMethod = 'cash',
  amountReceived = null,
  changeBreakdown = [],
  idempotencySeed = '',
}: {
  businessId: string;
  cartItems: VentaCartItem[];
  paymentMethod?: PaymentMethod;
  amountReceived?: number | null;
  changeBreakdown?: CashChangeEntry[] | null;
  idempotencySeed?: string;
}) {
  return createVenta({
    businessId,
    cartItems,
    paymentMethod,
    amountReceived,
    changeBreakdown,
    idempotencySeed,
  });
}

export async function deleteVenta({
  businessId,
  saleId,
}: {
  businessId: string;
  saleId: string;
}) {
  return deleteVentaWithDetails({
    businessId,
    saleId,
  });
}
