import { useCallback, useRef, useState } from 'react';
import * as Print from 'expo-print';
import { buildSaleReceiptHtml } from '../../../utils/printTemplates';
import { ensureBluetoothEnabled, BLUETOOTH_PRINT_REQUIRED_MESSAGE } from '../../../utils/bluetooth';
import { getThermalPaperWidthMm } from '../../../utils/printer';
import type { VentaDetailRecord, VentaRecord } from '../../../services/ventasService';

export type UseMesaPrintProps = {
  setOrderModalError: (msg: string | null) => void;
};

export type UseMesaPrintReturn = {
  showPrintModal: boolean;
  setShowPrintModal: (v: boolean) => void;
  printSalesData: { saleRecord: VentaRecord; saleDetails: VentaDetailRecord[] }[];
  setPrintSalesData: (v: { saleRecord: VentaRecord; saleDetails: VentaDetailRecord[] }[]) => void;
  isPrintingReceipt: boolean;
  printCustomerName: string;
  setPrintCustomerName: (v: string) => void;
  isPrintInProgress: boolean;
  beginPrintFlow: () => boolean;
  endPrintFlow: () => void;
  handlePrintConfirm: () => Promise<void>;
  handlePrintCancel: () => void;
};

export function useMesaPrint({ setOrderModalError }: UseMesaPrintProps): UseMesaPrintReturn {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSalesData, setPrintSalesData] = useState<
    { saleRecord: VentaRecord; saleDetails: VentaDetailRecord[] }[]
  >([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [printCustomerName, setPrintCustomerName] = useState('Venta general');
  const [isPrintInProgress, setIsPrintInProgress] = useState(false);
  const printInFlightRef = useRef(false);

  const beginPrintFlow = useCallback(() => {
    if (printInFlightRef.current) return false;
    printInFlightRef.current = true;
    setIsPrintInProgress(true);
    return true;
  }, []);

  const endPrintFlow = useCallback(() => {
    printInFlightRef.current = false;
    setIsPrintInProgress(false);
  }, []);

  const resetPrintState = useCallback(() => {
    setShowPrintModal(false);
    setPrintSalesData([]);
    setPrintCustomerName('Venta general');
  }, []);

  const handlePrintConfirm = useCallback(async () => {
    const btReady = await ensureBluetoothEnabled();
    if (!btReady) {
      setOrderModalError(BLUETOOTH_PRINT_REQUIRED_MESSAGE);
      resetPrintState();
      return;
    }

    if (!beginPrintFlow()) {
      setOrderModalError('Ya hay una impresión en curso. Espera a que finalice.');
      return;
    }

    setIsPrintingReceipt(true);
    try {
      const printerWidthMm = await getThermalPaperWidthMm();

      for (const { saleRecord, saleDetails } of printSalesData) {
        try {
          const html = buildSaleReceiptHtml({
            sale: saleRecord,
            saleDetails,
            sellerName: saleRecord.seller_name,
            printerWidthMm,
            customerName: printCustomerName,
          });

          await Print.printAsync({ html });
        } catch {
          setOrderModalError('No se pudo imprimir alguno de los comprobantes.');
        }
      }
    } catch {
      setOrderModalError('No se pudo imprimir los comprobantes.');
    } finally {
      endPrintFlow();
      setIsPrintingReceipt(false);
      resetPrintState();
    }
  }, [
    beginPrintFlow,
    endPrintFlow,
    printSalesData,
    printCustomerName,
    resetPrintState,
    setOrderModalError,
  ]);

  const handlePrintCancel = useCallback(() => {
    resetPrintState();
  }, [resetPrintState]);

  return {
    showPrintModal,
    setShowPrintModal,
    printSalesData,
    setPrintSalesData,
    isPrintingReceipt,
    printCustomerName,
    setPrintCustomerName,
    isPrintInProgress,
    beginPrintFlow,
    endPrintFlow,
    handlePrintConfirm,
    handlePrintCancel,
  };
}
