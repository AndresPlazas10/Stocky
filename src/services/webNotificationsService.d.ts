interface NotifyResult {
  ok: boolean;
  status: number | null;
  message: string;
  data?: unknown;
}

export function notifyAdminEmployeeLoginWeb(params: {
  accessToken: string;
  businessId: string;
  employeeName?: string | null;
}): Promise<NotifyResult>;

export function notifyAdminSaleRegisteredWeb(params: {
  accessToken: string;
  businessId: string;
  saleTotal: number;
}): Promise<NotifyResult>;

export function notifyAdminLowStockWeb(params: {
  accessToken: string;
  businessId: string;
  productIds: string[];
}): Promise<NotifyResult>;
