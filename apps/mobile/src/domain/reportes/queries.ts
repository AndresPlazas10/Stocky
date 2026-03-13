import { getSupabaseClient } from '../../lib/supabase';
import type {
  ReportesPaymentBreakdownItem,
  ReportesPeriod,
  ReportesSellerBreakdownItem,
  ReportesSnapshot,
} from './contracts';

type ListReportesOptions = {
  period?: ReportesPeriod;
  limit?: number | null;
};

type ReportesVentaRow = {
  id: string;
  total: number;
  created_at: string | null;
  seller_name: string;
  payment_method: string;
};

type ReportesCompraRow = {
  id: string;
  total: number;
  created_at: string | null;
};

const PAGE_SIZE = 500;

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePeriodStart(period: ReportesPeriod): Date | null {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === '7d') {
    return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  }
  if (period === '30d') {
    return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  }
  return null;
}

function isWithinPeriod(createdAt: string | null, periodStart: Date | null) {
  if (periodStart === null) return true;
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  return Number.isFinite(ts) && ts >= periodStart.getTime();
}

function normalizeVentaRow(row: any): ReportesVentaRow {
  return {
    id: normalizeText(row?.id),
    total: normalizeNumber(row?.total, 0),
    created_at: normalizeReference(row?.created_at),
    seller_name: normalizeReference(row?.seller_name) || 'Sin vendedor',
    payment_method: normalizeText(row?.payment_method).toLowerCase() || 'other',
  };
}

function normalizeCompraRow(row: any): ReportesCompraRow {
  return {
    id: normalizeText(row?.id),
    total: normalizeNumber(row?.total, 0),
    created_at: normalizeReference(row?.created_at),
  };
}

function resolvePaymentMethodLabel(method: string) {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  return method || 'Otro';
}

function buildPaymentBreakdown(ventas: ReportesVentaRow[]): ReportesPaymentBreakdownItem[] {
  const map = new Map<string, ReportesPaymentBreakdownItem>();

  for (const venta of ventas) {
    const method = String(venta.payment_method || 'other').toLowerCase();
    const current = map.get(method) || {
      method,
      label: resolvePaymentMethodLabel(method),
      count: 0,
      total: 0,
    };

    current.count += 1;
    current.total += Number(venta.total || 0);
    map.set(method, current);
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function buildTopSellers(ventas: ReportesVentaRow[]): ReportesSellerBreakdownItem[] {
  const map = new Map<string, ReportesSellerBreakdownItem>();

  for (const venta of ventas) {
    const sellerName = String(venta.seller_name || 'Sin vendedor').trim() || 'Sin vendedor';
    const current = map.get(sellerName) || {
      sellerName,
      count: 0,
      total: 0,
    };

    current.count += 1;
    current.total += Number(venta.total || 0);
    map.set(sellerName, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function filterByPeriod<T extends { created_at: string | null }>(rows: T[], period: ReportesPeriod) {
  const periodStart = resolvePeriodStart(period);
  return rows.filter((row) => isWithinPeriod(row.created_at, periodStart));
}

async function fetchVentasForReportes(
  businessId: string,
  {
    period = '30d',
    limit = null,
  }: ListReportesOptions = {},
): Promise<ReportesVentaRow[]> {
  const client = getSupabaseClient();
  const periodStart = resolvePeriodStart(period);
  const periodStartIso = periodStart ? periodStart.toISOString() : null;

  const rows: ReportesVentaRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = client
      .from('sales')
      .select('id,total,created_at,seller_name,payment_method')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (periodStartIso) {
      query = query.gte('created_at', periodStartIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    const chunk = (Array.isArray(data) ? data : []).map(normalizeVentaRow);
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) break;
    if (limit !== null && rows.length >= limit) break;
    page += 1;
  }

  if (limit !== null) {
    return rows.slice(0, limit);
  }
  return rows;
}

async function fetchComprasForReportes(
  businessId: string,
  {
    period = '30d',
    limit = null,
  }: ListReportesOptions = {},
): Promise<ReportesCompraRow[]> {
  const client = getSupabaseClient();
  const periodStart = resolvePeriodStart(period);
  const periodStartIso = periodStart ? periodStart.toISOString() : null;

  const rows: ReportesCompraRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = client
      .from('purchases')
      .select('id,total,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (periodStartIso) {
      query = query.gte('created_at', periodStartIso);
    }

    const { data, error } = await query;
    if (error) throw error;

    const chunk = (Array.isArray(data) ? data : []).map(normalizeCompraRow);
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) break;
    if (limit !== null && rows.length >= limit) break;
    page += 1;
  }

  if (limit !== null) {
    return rows.slice(0, limit);
  }
  return rows;
}

export async function listReportesByBusinessId(
  businessId: string,
  {
    period = '30d',
    limit = null,
  }: ListReportesOptions = {},
): Promise<ReportesSnapshot> {
  const [ventasRaw, comprasRaw] = await Promise.all([
    fetchVentasForReportes(businessId, { period, limit }),
    fetchComprasForReportes(businessId, { period, limit }),
  ]);

  const ventas = filterByPeriod(ventasRaw, period);
  const compras = filterByPeriod(comprasRaw, period);

  const ventasTotal = ventas.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const comprasTotal = compras.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return {
    businessId,
    period,
    generatedAt: new Date().toISOString(),
    ventasCount: ventas.length,
    comprasCount: compras.length,
    ventasTotal,
    comprasTotal,
    grossResult: ventasTotal - comprasTotal,
    avgTicket: ventas.length > 0 ? ventasTotal / ventas.length : 0,
    paymentBreakdown: buildPaymentBreakdown(ventas),
    topSellers: buildTopSellers(ventas),
  };
}

export async function listComprasForReportes(
  businessId: string,
  {
    period = '30d',
    limit = null,
  }: ListReportesOptions = {},
): Promise<ReportesCompraRow[]> {
  return fetchComprasForReportes(businessId, { period, limit });
}

export async function listVentasForReportes(
  businessId: string,
  {
    period = '30d',
    limit = null,
  }: ListReportesOptions = {},
): Promise<ReportesVentaRow[]> {
  return fetchVentasForReportes(businessId, { period, limit });
}
