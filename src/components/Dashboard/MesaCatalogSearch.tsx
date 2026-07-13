import { type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatPrice } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

interface CatalogItem {
  item_type: string;
  id: string;
  name: string;
  sale_price?: number;
}

interface MesaCatalogSearchProps {
  searchProduct: string;
  onSearchChange: (value: string) => void;
  filteredCatalog: CatalogItem[];
  visibleFilteredCatalog: CatalogItem[];
  hasMoreFilteredCatalog: boolean;
  totalFilteredCatalog: number;
  filteredCatalogSentinelRef: RefObject<HTMLDivElement | null>;
  lowMotionMode: boolean;
  onAddItem: (item: CatalogItem) => void;
  onLoadMore: () => void;
}

const ORDER_ITEM_TYPE = { PRODUCT: 'product', COMBO: 'combo' };

export function MesaCatalogSearch({
  searchProduct,
  onSearchChange,
  filteredCatalog,
  visibleFilteredCatalog,
  hasMoreFilteredCatalog,
  totalFilteredCatalog,
  filteredCatalogSentinelRef,
  lowMotionMode,
  onAddItem,
  onLoadMore,
}: MesaCatalogSearchProps) {
  const { t } = useTranslation(['mesas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  
  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-primary-700 mb-3">
        <Search className="w-4 h-4 inline mr-2" />
        {t('mesas:labels.addProduct')}
      </label>
      <Input
        type="text"
        placeholder={t('mesas:labels.searchProduct')}
        value={searchProduct}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-12 border-accent-300"
      />

      <AnimatePresence>
        {searchProduct && filteredCatalog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 border-2 border-accent-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-lg"
          >
            {visibleFilteredCatalog.map((catalogItem, index) => (
              <motion.div
                key={`${catalogItem.item_type}:${catalogItem.id}`}
                initial={lowMotionMode ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={lowMotionMode ? { duration: 0 } : { duration: 0.15, delay: index * 0.01 }}
                onClick={() => onAddItem(catalogItem)}
                className="p-4 border-b border-accent-100 last:border-0 transition-colors flex cursor-pointer justify-between items-center hover:bg-accent-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-primary-900 truncate">
                    {catalogItem.name}
                  </span>
                  {catalogItem.item_type === ORDER_ITEM_TYPE.COMBO && (
                    <Badge className="bg-gray-100 text-gray-700">Combo</Badge>
                  )}
                </div>
                <span className="text-lg font-bold text-green-600">
                  {fmtPrice(catalogItem.sale_price || 0)}
                </span>
              </motion.div>
            ))}
            {hasMoreFilteredCatalog && (
              <div className="border-t border-accent-100 p-2.5 bg-white">
                <div ref={filteredCatalogSentinelRef} className="h-2 w-full" aria-hidden="true" />
                <Button
                  type="button"
                  onClick={onLoadMore}
                  variant="outline"
                  className="mt-2 w-full h-9 text-xs"
                >
                  {t('mesas:buttons.loadMore')} ({visibleFilteredCatalog.length}/{totalFilteredCatalog})
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
