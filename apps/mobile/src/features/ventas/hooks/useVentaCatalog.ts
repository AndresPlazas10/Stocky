import { useCallback, useMemo, useState } from 'react';
import { getFirstVentaDayKey, listVentasCatalog } from '../../../services/ventasService';
import { getErrorMessage } from '../../../utils/error';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';

export function useVentaCatalog(businessId: string) {
  const [catalogItems, setCatalogItems] = useState<MesaOrderCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [isSaleSearchFocused, setIsSaleSearchFocused] = useState(false);
  const [firstVentaDayKey, setFirstVentaDayKey] = useState<string | null>(null);

  const loadCatalogData = useCallback(
    async (forceRefresh = false) => {
      setLoadingCatalog(true);
      try {
        const [catalog, firstDay] = await Promise.all([
          listVentasCatalog(businessId, forceRefresh ? { forceRefresh: true } : { ttlMs: 90_000 }),
          getFirstVentaDayKey(businessId, { ttlMs: 5 * 60_000 }).catch(() => null),
        ]);
        setCatalogItems(catalog);
        setFirstVentaDayKey(firstDay);
      } finally {
        setLoadingCatalog(false);
      }
    },
    [businessId],
  );

  const refreshCatalogSilently = useCallback(async () => {
    try {
      const catalog = await listVentasCatalog(businessId, { forceRefresh: true });
      setCatalogItems(catalog);
    } catch (err) {
      if (__DEV__) console.error('[Ventas] error al refrescar catálogo silenciosamente:', getErrorMessage(err));
    }
  }, [businessId]);

  const catalogQuery = useMemo(
    () =>
      String(searchCatalog || '')
        .trim()
        .toLowerCase(),
    [searchCatalog],
  );
  const hasCatalogQuery = catalogQuery.length > 0;

  const catalogFiltered = useMemo(() => {
    const sourceData = Array.isArray(catalogItems) ? catalogItems : [];
    if (!hasCatalogQuery) return [];
    return sourceData
      .filter((item) => {
        const byName = String(item.name || '')
          .toLowerCase()
          .includes(catalogQuery);
        const byCode = String(item.code || '')
          .toLowerCase()
          .includes(catalogQuery);
        return byName || byCode;
      })
      .slice(0, 80);
  }, [catalogItems, catalogQuery, hasCatalogQuery]);

  return {
    catalogItems,
    setCatalogItems,
    loadingCatalog,
    searchCatalog,
    setSearchCatalog,
    isSaleSearchFocused,
    setIsSaleSearchFocused,
    firstVentaDayKey,
    loadCatalogData,
    refreshCatalogSilently,
    catalogQuery,
    hasCatalogQuery,
    catalogFiltered,
  };
}
