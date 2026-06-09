import { useMemo, useState } from 'react';
import { COMBO_STATUS, type ComboProductRecord, type ComboRecord } from '../../../services/combosService';
import { normalizeStatus, type ComboStatusFilter } from '../comboUtils';

export function useComboSearch(combos: ComboRecord[]) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComboStatusFilter>('all');
  const [productSearch, setProductSearch] = useState('');

  const filteredCombos = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return combos.filter((combo) => {
      if (statusFilter !== 'all' && normalizeStatus(combo.estado) !== statusFilter) {
        return false;
      }
      if (!term) return true;
      const byName = String(combo.nombre || '').toLowerCase().includes(term);
      const byDescription = String(combo.descripcion || '').toLowerCase().includes(term);
      const byId = String(combo.id || '').toLowerCase().includes(term);
      const byPrice = String(Math.round(Number(combo.precio_venta || 0))).includes(term);
      const byItems = (combo.combo_items || []).some((item) =>
        String(item.product?.name || '').toLowerCase().includes(term));
      return byName || byDescription || byId || byPrice || byItems;
    });
  }, [combos, search, statusFilter]);

  const totalActive = useMemo(
    () => combos.filter((combo) => normalizeStatus(combo.estado) === COMBO_STATUS.ACTIVE).length,
    [combos],
  );

  const filterProductCatalog = (products: ComboProductRecord[]) => {
    const term = String(productSearch || '').trim().toLowerCase();
    return products
      .filter((product) => {
        if (!term) return true;
        return String(product.name || '').toLowerCase().includes(term)
          || String(product.code || '').toLowerCase().includes(term);
      })
      .slice(0, 120);
  };

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    productSearch,
    setProductSearch,
    filteredCombos,
    totalActive,
    filterProductCatalog,
  };
}
