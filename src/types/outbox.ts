export type OutboxStatus = 'pending' | 'syncing' | 'processing' | 'acked' | 'rejected' | 'error';

export type OutboxEventType = 'sale.create' | 'order.create' | 'order.update' | 'purchase.create';

export interface OutboxPayload {
  businessId: string;
  cart?: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  paymentMethod?: string;
  total?: number;
  idempotencyKey?: string;
  tempSaleId?: string;
  queuedAt: string;
  [key: string]: unknown;
}

export interface OutboxEvent {
  id: string;
  type: OutboxEventType;
  status: OutboxStatus;
  attempts: number;
  created_at: string;
  updated_at: string;
  next_retry_at: string | null;
  last_error: string | null;
  payload: OutboxPayload;
}
