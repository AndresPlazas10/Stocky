import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { printSaleReceipt } from '../../../utils/printDispatcher';
import { useBusinessConfig } from '../../../contexts/BusinessConfigContext';
import type { VentaRecord } from '../../../services/ventasService';

export function useVentaPrint(
  businessName: string | null,
  setError: (error: string | null) => void,
) {
  const { t } = useTranslation('mesas');
  const { timezone } = useBusinessConfig();
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrintSale = useCallback(
    async (venta: VentaRecord) => {
      setError(null);
      setIsPrinting(true);

      try {
        const { listVentaDetails } = await import('../../../services/ventasService');
        const details = await listVentaDetails(venta.id);
        if (!Array.isArray(details) || details.length === 0) {
          setError(t('receipt.printError'));
          return;
        }

        const result = await printSaleReceipt(venta, details, {
          businessName: businessName ?? undefined,
          timezone,
          t,
        });

        if (!result.ok) {
          setError(result.error || t('print.printFailed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('print.printFailed'));
      } finally {
        setIsPrinting(false);
      }
    },
    [businessName, setError, t, timezone],
  );

  return {
    isPrinting,
    handlePrintSale,
  };
}
