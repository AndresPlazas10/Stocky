import { useCallback, useState } from 'react';
import { printSaleReceipt } from '../../../utils/printDispatcher';
import type { VentaDetailRecord, VentaRecord } from '../../../services/ventasService';

export function useVentaPrint(
  businessName: string | null,
  setError: (error: string | null) => void,
) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSaleDetails, setPrintSaleDetails] = useState<VentaDetailRecord[]>([]);
  const [printSaleRecord, setPrintSaleRecord] = useState<VentaRecord | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printCustomerName, setPrintCustomerName] = useState('Venta general');

  const showPrintModalForSale = useCallback((record: VentaRecord, details: VentaDetailRecord[]) => {
    setPrintSaleRecord(record);
    setPrintSaleDetails(details);
    setTimeout(() => {
      setShowPrintModal(true);
    }, 300);
  }, []);

  const handlePrintConfirm = useCallback(async () => {
    if (!printSaleRecord) return;

    setIsPrinting(true);
    try {
      const result = await printSaleReceipt(printSaleRecord, printSaleDetails, {
        customerName: printCustomerName,
        businessName: businessName ?? undefined,
      });

      if (!result.ok) {
        setError(result.error || 'No se pudo imprimir el comprobante.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al imprimir el comprobante.');
    } finally {
      setIsPrinting(false);
      setShowPrintModal(false);
      setPrintSaleRecord(null);
      setPrintSaleDetails([]);
      setPrintCustomerName('Venta general');
    }
  }, [printSaleRecord, printSaleDetails, printCustomerName, businessName, setError]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSaleRecord(null);
    setPrintSaleDetails([]);
    setPrintCustomerName('Venta general');
  }, []);

  const handlePrintSale = useCallback(
    async (venta: VentaRecord) => {
      setError(null);
      setIsPrinting(true);

      try {
        const { listVentaDetails } = await import('../../../services/ventasService');
        const details = await listVentaDetails(venta.id);
        if (!Array.isArray(details) || details.length === 0) {
          setError('No se pudo imprimir: la venta no tiene items.');
          return;
        }

        const result = await printSaleReceipt(venta, details, {
          businessName: businessName ?? undefined,
        });

        if (!result.ok) {
          setError(result.error || 'No se pudo imprimir la venta.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo imprimir la venta.');
      } finally {
        setIsPrinting(false);
      }
    },
    [businessName, setError],
  );

  return {
    showPrintModal,
    setShowPrintModal,
    printSaleDetails,
    printSaleRecord,
    isPrinting,
    printCustomerName,
    setPrintCustomerName,
    showPrintModalForSale,
    handlePrintConfirm,
    handlePrintCancel,
    handlePrintSale,
  };
}
