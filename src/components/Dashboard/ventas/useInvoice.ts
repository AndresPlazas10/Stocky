import { useState, useCallback } from 'react';
import { sendInvoiceEmail } from '@/utils/emailService';
import { getBusinessNameById } from '@/data/queries/salesQueries';
import { getSaleDetailDisplayName } from './ventasHelpers';

export function useInvoice(
  businessId: string,
  fetchSaleDetails: (saleId: string) => Promise<any[]>,
  showSuccess: (title: string, message?: string) => void,
  showError: (title: string, message?: string) => void,
  t: (key: string, options?: any) => string,
) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState('');
  const [invoiceCustomerIdNumber, setInvoiceCustomerIdNumber] = useState('');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const openInvoiceModal = useCallback((sale: any) => {
    setShowInvoiceModal(true);
  }, []);

  const closeInvoiceModal = useCallback(() => {
    setShowInvoiceModal(false);
    setInvoiceCustomerName('');
    setInvoiceCustomerEmail('');
    setInvoiceCustomerIdNumber('');
  }, []);

  const generateInvoiceFromSale = useCallback(async (selectedSale: any) => {
    if (!invoiceCustomerEmail || !invoiceCustomerEmail.includes('@')) {
      showError('Error', t('ventas:errors.emailRequired'));
      return;
    }
    if (!invoiceCustomerName) {
      showError('Error', t('ventas:errors.nameRequired'));
      return;
    }

    try {
      setGeneratingInvoice(true);

      const saleDetails = await fetchSaleDetails(selectedSale.id);

      const total = selectedSale.total;

      const comprobanteNumber = `COMP-${selectedSale.id.substring(0, 8).toUpperCase()}`;

      const emailItems = saleDetails.map((detail: any) => ({
        product_name: getSaleDetailDisplayName(detail, t),
        quantity: detail.quantity,
        unit_price: detail.unit_price
      }));

      const businessName = await getBusinessNameById(businessId);

      const emailResult = await sendInvoiceEmail({
        email: invoiceCustomerEmail,
        invoiceNumber: comprobanteNumber,
        customerName: invoiceCustomerName,
        total: total,
        items: emailItems,
        businessName: businessName || 'Stocky',
        businessId,
        issuedAt: new Date(selectedSale?.created_at || Date.now()).toISOString()
      });

      if (emailResult.success) {
        showSuccess(t('ventas:email.sentSuccessfully'), invoiceCustomerEmail);
      } else {
        throw new Error(emailResult.error || t('ventas:errors.sendFailed'));
      }

      closeInvoiceModal();
    } catch (error: any) {
      showError('Error', error.message || t('ventas:errors.sendFailedRetry'));
    } finally {
      setGeneratingInvoice(false);
    }
  }, [businessId, invoiceCustomerName, invoiceCustomerEmail, fetchSaleDetails, closeInvoiceModal, showSuccess, showError, t]);

  return {
    showInvoiceModal, setShowInvoiceModal,
    invoiceCustomerName, setInvoiceCustomerName,
    invoiceCustomerEmail, setInvoiceCustomerEmail,
    invoiceCustomerIdNumber, setInvoiceCustomerIdNumber,
    generatingInvoice,
    openInvoiceModal, closeInvoiceModal,
    generateInvoiceFromSale,
  };
}
