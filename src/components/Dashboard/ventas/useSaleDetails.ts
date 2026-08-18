import { useState, useCallback } from 'react';
import { getSaleDetailsBySaleId, getSaleCashMetadataBySaleId } from '@/data/queries/salesQueries';
import { logger } from '@/utils/logger';

export function useSaleDetails(t: (key: string, options?: any) => string) {
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [saleDetailsLoading, setSaleDetailsLoading] = useState(false);
  const [saleDetailsError, setSaleDetailsError] = useState('');

  const fetchSaleDetails = useCallback(async (saleId: string) => {
    if (!saleId) return [];
    return getSaleDetailsBySaleId(saleId);
  }, []);

  const openSaleDetailsModal = useCallback(async (sale: any) => {
    setSelectedSale({ ...sale, sale_details: [] });
    setShowSaleDetailsModal(true);
    setSaleDetailsError('');

    try {
      setSaleDetailsLoading(true);
      const details = await fetchSaleDetails(sale.id);
      let saleInfo: any = {};
      try {
        const infoData = await getSaleCashMetadataBySaleId(sale.id);
        if (infoData) {
          saleInfo = infoData;
        }
      } catch (err) {
        logger.warn('ventas:fetch_sale_cash_metadata failed', err);
      }

      setSelectedSale({
        ...sale,
        amount_received: (saleInfo as any).amount_received ?? sale.amount_received ?? null,
        change_amount: (saleInfo as any).change_amount ?? sale.change_amount ?? null,
        change_breakdown: (saleInfo as any).change_breakdown ?? sale.change_breakdown ?? [],
        sale_details: details
      });
    } catch (err: any) {
      setSaleDetailsError(err?.message || t('ventas:errors.detailsFailed'));
    } finally {
      setSaleDetailsLoading(false);
    }
  }, [fetchSaleDetails, t]);

  const closeSaleDetailsModal = useCallback(() => {
    setShowSaleDetailsModal(false);
    setSelectedSale(null);
  }, []);

  return {
    selectedSale, setSelectedSale,
    showSaleDetailsModal, setShowSaleDetailsModal,
    saleDetailsLoading, saleDetailsError, setSaleDetailsError,
    fetchSaleDetails, openSaleDetailsModal, closeSaleDetailsModal,
  };
}
