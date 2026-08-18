import { useState, useCallback } from 'react';
import { printSaleReceipt } from '@/utils/saleReceiptPrint';
import { getBusinessNameById } from '@/data/queries/salesQueries';
import { getVendedorName } from './ventasHelpers';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';
import { logger } from '@/utils/logger';

export function usePrintReceipt(
  businessId: string,
  showError: (title: string, message?: string) => void,
  t: (key: string, options?: any) => string,
) {
  const config = useBusinessConfig();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSaleData, setPrintSaleData] = useState<any>(null);
  const [printSaleDetails, setPrintSaleDetails] = useState<any[]>([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [printCustomerName, setPrintCustomerName] = useState(t('ventas:print.defaultCustomer'));

  const handlePrintConfirm = useCallback(async () => {
    if (!printSaleData) {
      showError('Error', t('ventas:errors.noPrintData'));
      return;
    }

    setIsPrintingReceipt(true);
    try {
      const printResult = await printSaleReceipt({
        sale: printSaleData,
        saleDetails: printSaleDetails,
        sellerName: printSaleData.seller_name || getVendedorName(printSaleData, t),
        businessName: await getBusinessNameById(businessId),
        customerName: printCustomerName,
        timezone: config.timezone,
      });

      if (!printResult.ok) {
        showError('Error', t('ventas:errors.printFailed'));
      }
    } catch (err) {
      logger.error('print_receipt_failed', err);
      showError('Error', t('ventas:errors.printFailed'));
    } finally {
      setIsPrintingReceipt(false);
      setShowPrintModal(false);
      setPrintSaleData(null);
      setPrintSaleDetails([]);
    }
  }, [printSaleData, printSaleDetails, printCustomerName, businessId, showError, t, config]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSaleData(null);
    setPrintSaleDetails([]);
    setPrintCustomerName(t('ventas:print.defaultCustomer'));
  }, [t]);

  const handlePrintInvoice = useCallback(async (
    sale: any,
    fetchSaleDetails: (saleId: string) => Promise<any[]>,
  ) => {
    let saleDetails: any[] = [];
    try {
      saleDetails = await fetchSaleDetails(sale.id);
    } catch {
      showError('Error', t('ventas:errors.detailsFailed'));
      return;
    }

    if (!saleDetails || saleDetails.length === 0) {
      showError('Error', t('ventas:errors.detailsFailed'));
      return;
    }

    const printResult = await printSaleReceipt({
      sale: sale,
      saleDetails,
      sellerName: getVendedorName(sale, t),
      businessName: await getBusinessNameById(businessId),
      timezone: config.timezone,
    });

    if (!printResult.ok) {
      showError('Error', t('ventas:errors.printWindowFailed'));
    }
  }, [businessId, showError, t, config]);

  return {
    showPrintModal, setShowPrintModal,
    printSaleData, setPrintSaleData,
    printSaleDetails, setPrintSaleDetails,
    isPrintingReceipt,
    printCustomerName, setPrintCustomerName,
    handlePrintConfirm,
    handlePrintCancel,
    handlePrintInvoice,
  };
}
