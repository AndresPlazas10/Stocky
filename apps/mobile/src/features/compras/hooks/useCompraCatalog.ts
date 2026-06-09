import { useCallback, useMemo, useState } from 'react';
import {
  listPurchaseProducts,
  listPurchaseSuppliers,
  type CompraProductRecord,
  type CompraSupplierRecord,
} from '../../../services/comprasService';
import type { CompraCartItem } from '../../../services/comprasService';

export function useCompraCatalog(businessId: string) {
  const [products, setProducts] = useState<CompraProductRecord[]>([]);
  const [suppliers, setSuppliers] = useState<CompraSupplierRecord[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const loadCatalogData = useCallback(async (forceRefresh = false) => {
    setLoadingCatalog(true);
    try {
      const [productsResult, suppliersResult] = await Promise.all([
        listPurchaseProducts(businessId, { forceRefresh }),
        listPurchaseSuppliers(businessId, { forceRefresh }),
      ]);
      setProducts(productsResult);
      setSuppliers(suppliersResult);
    } catch (err) {
      throw err;
    } finally {
      setLoadingCatalog(false);
    }
  }, [businessId]);

  const refreshCatalogSilently = useCallback(async () => {
    try {
      const [productsResult, suppliersResult] = await Promise.all([
        listPurchaseProducts(businessId, { forceRefresh: true }),
        listPurchaseSuppliers(businessId, { forceRefresh: true }),
      ]);
      setProducts(productsResult);
      setSuppliers(suppliersResult);
    } catch {}
  }, [businessId]);

  const refreshProductsSilently = useCallback(async () => {
    try {
      const productsResult = await listPurchaseProducts(businessId, { forceRefresh: true });
      setProducts(productsResult);
    } catch {}
  }, [businessId]);

  const purchaseSupplierLabel = useMemo(() => {
    if (!supplierId) return 'Sin proveedor seleccionado';
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return 'Sin proveedor seleccionado';
    return supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
  }, [supplierId, suppliers]);

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((supplier) => {
      const label = supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
      map.set(supplier.id, label);
    });
    return map;
  }, [suppliers]);

  const productsFiltered = useMemo(() => {
    return (cart: CompraCartItem[]) => {
      const cartProductIds = new Set(cart.map((item) => item.product_id));
      const search = String(productSearch || '').trim().toLowerCase();
      return products
        .filter((product) => {
          if (cartProductIds.has(product.id)) return false;
          if (supplierId && product.supplier_id !== supplierId) return false;
          if (!search) return true;
          return String(product.name || '').toLowerCase().includes(search);
        })
        .slice(0, 120);
    };
  }, [productSearch, products, supplierId]);

  return {
    products,
    setProducts,
    suppliers,
    setSuppliers,
    loadingCatalog,
    productSearch,
    setProductSearch,
    supplierId,
    setSupplierId,
    loadCatalogData,
    refreshCatalogSilently,
    refreshProductsSilently,
    purchaseSupplierLabel,
    supplierNameById,
    productsFiltered,
  };
}
