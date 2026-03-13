export type ReportesPeriod = 'today' | '7d' | '30d' | 'all';

export type ReportesPaymentBreakdownItem = {
  method: string;
  label: string;
  count: number;
  total: number;
};

export type ReportesSellerBreakdownItem = {
  sellerName: string;
  count: number;
  total: number;
};

export type ReportesSnapshot = {
  businessId: string;
  period: ReportesPeriod;
  generatedAt: string;
  ventasCount: number;
  comprasCount: number;
  ventasTotal: number;
  comprasTotal: number;
  grossResult: number;
  avgTicket: number;
  paymentBreakdown: ReportesPaymentBreakdownItem[];
  topSellers: ReportesSellerBreakdownItem[];
};
