import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSaleWithOutbox } from '@/data/commands/salesCommands';
import { getSaleForPrintById, getSaleDetailsBySaleId } from '@/data/queries/salesQueries';
import { recordSaleCreationTime } from '@/services/salesServiceOptimized';
import { buildCartConsumptionByProduct, applyOfflineStockConsumption } from '@/utils/offlineStockGuards';
import { isAutoPrintReceiptEnabled } from '@/utils/printer';
import { saveOfflineSnapshot } from '@/utils/offlineSnapshot';
import { getPaymentMethodLabel } from '@/components/ui/PaymentMethodBankLogo';
import { buildDiagnosticAlertMessage } from './ventasHelpers';
import { logger } from '@/utils/logger';

interface UseSaleProcessorParams {
  businessId: string;
  cart: any[];
  comboById: Map<string, any>;
  comboStockShortages: any[];
  simpleStockShortages: any[];
  paymentMethod: string;
  sessionChecked: boolean;
  saleIntentSignature: string;
  saleIntentKeyRef: React.MutableRefObject<string | null>;
  saleIntentSignatureRef: React.MutableRefObject<string>;
  fmtPrice: (value: any, includeCurrency?: boolean) => string;
  t: (key: string, options?: any) => string;
  loadVentas: (filters?: any, pagination?: any) => Promise<void>;
  currentFilters: any;
  limit: number;
  page: number;
  setSales: (v: any[] | ((prev: any[]) => any[])) => void;
  setTotalCount: (v: number | ((prev: number) => number)) => void;
  setProducts: (v: any[] | ((prev: any[]) => any[])) => void;
  setCart: (v: any[] | ((prev: any[]) => any[])) => void;
  setSelectedCustomer: (v: string) => void;
  setPaymentMethod: (v: string) => void;
  setShowSaleModal: (v: boolean) => void;
  setSaleModalPanel: (v: string) => void;
  setPrintSaleData: (v: any) => void;
  setPrintSaleDetails: (v: any[]) => void;
  setShowPrintModal: (v: boolean) => void;
  setError: (v: string | null) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showLoading: (message: string) => void;
}

export function useSaleProcessor({
  businessId,
  cart,
  comboById,
  comboStockShortages,
  simpleStockShortages,
  paymentMethod,
  sessionChecked,
  saleIntentSignature,
  saleIntentKeyRef,
  saleIntentSignatureRef,
  fmtPrice,
  t,
  loadVentas,
  currentFilters,
  limit,
  page,
  setSales,
  setTotalCount,
  setProducts,
  setCart,
  setSelectedCustomer,
  setPaymentMethod,
  setShowSaleModal,
  setSaleModalPanel,
  setPrintSaleData,
  setPrintSaleDetails,
  setShowPrintModal,
  setError,
  showSuccess,
  showError,
  showLoading,
}: UseSaleProcessorParams) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const processSale = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    showLoading(t('ventas:labels.generating'));

    try {
      if (cart.length === 0) {
        throw new Error('⚠️ ' + t('errors.emptyCart'));
      }

      if (!sessionChecked) {
        throw new Error('⚠️ ' + t('ventas:errors.sessionRequired'));
      }

      if (comboStockShortages.length > 0) {
        const firstShortage = comboStockShortages[0];
        throw new Error(
          t('ventas:labels.insufficientComboStock') + ` "${firstShortage.product_name}". ` +
          t('ventas:labels.availableRequired', { available: firstShortage.available_stock, required: firstShortage.required_quantity })
        );
      }

      if (simpleStockShortages.length > 0) {
        const firstShortage = simpleStockShortages[0];
        throw new Error(
          t('ventas:labels.insufficientProductStock') + ` "${firstShortage.product_name}". ` +
          t('ventas:labels.availableRequired', { available: firstShortage.available_stock, required: firstShortage.required_quantity })
        );
      }

      const saleTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      const startTime = performance.now();
      if (saleIntentSignatureRef.current !== saleIntentSignature) {
        saleIntentSignatureRef.current = saleIntentSignature;
        saleIntentKeyRef.current = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
      }

      const result = await createSaleWithOutbox({
        businessId,
        cart,
        paymentMethod,
        total: saleTotal,
        idempotencyKey: saleIntentKeyRef.current
      });

      const elapsedMs = performance.now() - startTime;

      if (!(result as any).success) {
        throw new Error((result as any).error || t('ventas:errors.processFailed'));
      }

      recordSaleCreationTime(elapsedMs);

      showSuccess(t('alerts.saleCreated'), `${t('labels.total', { ns: 'common' })}: ${fmtPrice(saleTotal)} | ${t('ventas:labels.paymentMethodLabel')}: ${getPaymentMethodLabel(paymentMethod, t)} | ${t('ventas:labels.time')}: ${elapsedMs.toFixed(0)}ms | ${t('ventas:labels.articles')}: ${cart.length}`);

      if (result?.data?.pending_sync) {
        const pendingSale = {
          id: result?.data?.id,
          business_id: businessId,
          user_id: null,
          seller_name: t('ventas:labels.offlineSale'),
          payment_method: paymentMethod,
          total: Number(saleTotal || 0),
          created_at: result?.data?.created_at || new Date().toISOString(),
          notes: t('ventas:labels.pendingSync'),
          pending_sync: true,
          employees: { full_name: t('status.pendingSync', { ns: 'common' }), role: 'employee' }
        };

        setSales((prev) => {
          const next = [pendingSale, ...prev];
          saveOfflineSnapshot(`ventas.list:${businessId}`, next);
          return next;
        });
        setTotalCount((prev) => prev + 1);

        const consumptionByProduct = buildCartConsumptionByProduct({ cart, comboById });

        setProducts((prevProducts) => {
          const nextProducts = applyOfflineStockConsumption({
            products: prevProducts,
            consumptionByProduct
          });

          saveOfflineSnapshot(`ventas.productos:${businessId}`, nextProducts);
          return nextProducts;
        });
      }

      if (isAutoPrintReceiptEnabled()) {
        const isPendingSync = !!result?.data?.pending_sync;

        let saleForPrint: any = null;
        let detailsForPrint: any[] = [];

        if (isPendingSync) {
          saleForPrint = {
            id: result.data.id,
            total: saleTotal,
            payment_method: paymentMethod,
            created_at: result?.data?.created_at || new Date().toISOString(),
            seller_name: t('ventas:labels.offlineSale')
          };
          detailsForPrint = cart.map((item) => ({
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            subtotal: Number(item.subtotal || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
            product_name: item.name || t('ventas:labels.item')
          }));
        } else {
          try {
            const [saleRow, saleDetails] = await Promise.all([
              getSaleForPrintById(result.data.id),
              getSaleDetailsBySaleId(result.data.id)
            ]);

            saleForPrint = saleRow || {
              id: result.data.id,
              total: saleTotal,
              payment_method: paymentMethod,
              created_at: new Date().toISOString(),
              seller_name: t('roles.employee', { ns: 'common' })
            };

            detailsForPrint = Array.isArray(saleDetails) ? saleDetails : [];
          } catch (error: any) {
            logger.warn('fetchSaleDetails for print failed', { saleId: result.data.id, error: error.message || error });
            saleForPrint = {
              id: result.data.id,
              total: saleTotal,
              payment_method: paymentMethod,
              created_at: new Date().toISOString(),
              seller_name: t('roles.employee', { ns: 'common' })
            };
            detailsForPrint = [];
          }
        }

        setPrintSaleData(saleForPrint);
        setPrintSaleDetails(detailsForPrint);

        setTimeout(() => {
          setShowPrintModal(true);
        }, 500);
      }

      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setShowSaleModal(false);
      saleIntentKeyRef.current = null;
      saleIntentSignatureRef.current = '';
      setSaleModalPanel('catalog');

      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });

    } catch (error: any) {
      if (String(error?.message || '').includes('sesión ha expirado') && (typeof navigator === 'undefined' || navigator.onLine)) {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
      setError(buildDiagnosticAlertMessage(error, t('ventas:errors.processFailed')));
      showError('Error', t('ventas:errors.processFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, sessionChecked, comboStockShortages, simpleStockShortages, comboById, businessId, paymentMethod, loadVentas, isSubmitting, currentFilters, limit, page, saleIntentSignature, navigate, fmtPrice, t, setSales, setTotalCount, setProducts, setCart, setSelectedCustomer, setPaymentMethod, setShowSaleModal, setSaleModalPanel, setPrintSaleData, setPrintSaleDetails, setShowPrintModal, setError, showSuccess, showError, showLoading, saleIntentKeyRef, saleIntentSignatureRef]);

  return { processSale, isSubmitting };
}
