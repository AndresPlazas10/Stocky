import { readAdapter } from '../adapters/localAdapter';

interface ReportsSnapshot {
  sales: unknown[];
  purchases: unknown[];
  products: unknown[];
  totalSuppliers: number;
  totalInvoices: number;
  saleDetails: unknown[];
  comboSaleDetails: unknown[];
  combos: unknown[];
  purchaseProducts: unknown[];
}

// El snapshot de reportes son 9 queries en paralelo: se cachea por negocio y
// rango (inicio del periodo) para que cambiar de pestaña y volver no las
// re-ejecute. El `end` de cada llamada es "ahora" y varía, pero dentro del TTL
// la diferencia es despreciable para un dashboard de reportes.
const REPORTS_SNAPSHOT_CACHE_TTL_MS = 30_000;
const reportsSnapshotCache = new Map<string, { cachedAt: number; data: ReportsSnapshot }>();

export async function getReportsSnapshot({
  businessId,
  start,
  end
}: {
  businessId: string;
  start: string;
  end: string;
}): Promise<ReportsSnapshot> {
  const cacheKey = `${businessId}|${start}`;
  const cached = reportsSnapshotCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= REPORTS_SNAPSHOT_CACHE_TTL_MS) {
    return cached.data;
  }

  const [
    { data: ventas, error: ventasError },
    { data: compras, error: comprasError },
    { data: productos, error: productosError },
    { count: totalProveedores, error: proveedoresError },
    { count: totalFacturas, error: facturasError },
    { data: saleDetails, error: saleDetailsError },
    { data: comboSaleDetails, error: comboSaleDetailsError },
    { data: combos, error: combosError },
    { data: purchaseProducts, error: purchaseProductsError }
  ] = await Promise.all([
    readAdapter.getSalesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getPurchasesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getActiveProductsStockByBusiness(businessId),
    readAdapter.countSuppliersByBusiness(businessId),
    readAdapter.countInvoicesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end }),
    readAdapter.getComboSaleDetailsByBusinessDateRange({ businessId, start, end }),
    readAdapter.getCombosByBusinessWithItems({ businessId, onlyActive: false }),
    readAdapter.getProductPurchasePricesByBusiness(businessId)
  ]);

  if (ventasError) throw ventasError;
  if (comprasError) throw comprasError;
  if (productosError) throw productosError;
  if (proveedoresError) throw proveedoresError;
  if (facturasError) throw facturasError;
  if (saleDetailsError) throw saleDetailsError;
  if (comboSaleDetailsError) throw comboSaleDetailsError;
  if (combosError) throw combosError;
  if (purchaseProductsError) throw purchaseProductsError;

  const snapshot: ReportsSnapshot = {
    sales: ventas || [],
    purchases: compras || [],
    products: productos || [],
    totalSuppliers: totalProveedores || 0,
    totalInvoices: totalFacturas || 0,
    saleDetails: saleDetails || [],
    comboSaleDetails: comboSaleDetails || [],
    combos: combos || [],
    purchaseProducts: purchaseProducts || []
  };

  reportsSnapshotCache.set(cacheKey, { cachedAt: Date.now(), data: snapshot });
  return snapshot;
}
