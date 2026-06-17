import { useMemo, useState } from 'react';
import type { InventoryProductRecord } from '../../../services/inventoryService';

export function useInventorySearch(products: InventoryProductRecord[]) {
  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(() => {
    const normalizedSearch = String(search || '')
      .trim()
      .toLowerCase();
    return products.filter((product) => {
      if (!normalizedSearch) return true;
      return String(product.name || '')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [products, search]);

  return {
    search,
    setSearch,
    filteredProducts,
  };
}
