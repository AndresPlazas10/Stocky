import {
  createCompraWithRpcFallback,
  deleteCompraWithStockFallback,
  type CompraCartItem,
} from '../../services/comprasService';

export async function mutateCompras({
  businessId,
  userId,
  supplierId,
  paymentMethod,
  notes,
  cart,
}: {
  businessId: string;
  userId: string;
  supplierId: string;
  paymentMethod: string;
  notes?: string | null;
  cart: CompraCartItem[];
}) {
  return createCompraWithRpcFallback({
    businessId,
    userId,
    supplierId,
    paymentMethod,
    notes,
    cart,
  });
}

export async function deleteCompra({
  businessId,
  purchaseId,
}: {
  businessId: string;
  purchaseId: string;
}) {
  return deleteCompraWithStockFallback({
    businessId,
    purchaseId,
  });
}
