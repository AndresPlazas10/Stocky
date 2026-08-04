const SALE_ITEM_TYPE = {
  PRODUCT: 'product' as const,
  COMBO: 'combo' as const,
};

const buildCartItemKey = (itemType: string, id: string): string => `${itemType}:${id}`;

export { SALE_ITEM_TYPE, buildCartItemKey };
