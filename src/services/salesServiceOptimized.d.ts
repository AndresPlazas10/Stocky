interface RpcSaleItem {
  product_id?: string | null;
  combo_id?: string | null;
  quantity: number;
  unit_price: number;
}

interface CreateSaleParams {
  businessId: string;
  cart: RpcSaleItem[];
  paymentMethod?: string;
  total?: number;
  idempotencyKey?: string | null;
}

interface CreateSaleResult {
  success: boolean;
  data?: {
    id: string;
    total: number;
    items_count: number;
    created_at: string;
  };
  error?: string;
}

interface SaleMetrics {
  avg: number;
  min: number;
  max: number;
  count: number;
}

export function createSaleOptimized(params: CreateSaleParams): Promise<CreateSaleResult>;

export function recordSaleCreationTime(milliseconds: number): void;

export function getSaleCreationMetrics(): SaleMetrics | null;
