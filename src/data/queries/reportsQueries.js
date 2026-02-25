import { readAdapter } from '../adapters/localAdapter';

export async function getReportsSnapshot({
  businessId,
  start,
  end
}) {
  const [
    { data: ventas, error: ventasError },
    { data: compras, error: comprasError },
    { data: productos, error: productosError },
    { count: totalProveedores, error: proveedoresError },
    { count: totalFacturas, error: facturasError },
    { data: saleDetails, error: saleDetailsError }
  ] = await Promise.all([
    readAdapter.getSalesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getPurchasesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getActiveProductsStockByBusiness(businessId),
    readAdapter.countSuppliersByBusiness(businessId),
    readAdapter.countInvoicesByBusinessDateRange({ businessId, start, end }),
    readAdapter.getSaleDetailsWithProductCostByBusinessDateRange({ businessId, start, end })
  ]);

  if (ventasError) throw ventasError;
  if (comprasError) throw comprasError;
  if (productosError) throw productosError;
  if (proveedoresError) throw proveedoresError;
  if (facturasError) throw facturasError;
  if (saleDetailsError) throw saleDetailsError;

  return {
    ventas: ventas || [],
    compras: compras || [],
    productos: productos || [],
    totalProveedores: totalProveedores || 0,
    totalFacturas: totalFacturas || 0,
    saleDetails: saleDetails || []
  };
}
