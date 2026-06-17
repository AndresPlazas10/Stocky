import { useCallback, useEffect, useRef, useState } from 'react';
import { listCompraDetails } from '../../../services/comprasService';
import type { CompraDetailRecord, CompraRecord } from '../../../services/comprasService';

export function useCompraDetails() {
  const [selectedPurchase, setSelectedPurchase] = useState<CompraRecord | null>(null);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<CompraDetailRecord[]>([]);
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);
  const [loadingPurchaseDetails, setLoadingPurchaseDetails] = useState(false);

  const selectedPurchaseIdRef = useRef<string>('');
  const showPurchaseDetailsRef = useRef(false);

  useEffect(() => {
    selectedPurchaseIdRef.current = String(selectedPurchase?.id || '').trim();
    showPurchaseDetailsRef.current = Boolean(showPurchaseDetails);
  }, [selectedPurchase?.id, showPurchaseDetails]);

  const openPurchaseDetails = useCallback(
    (purchase: CompraRecord, setError: (msg: string | null) => void) => {
      setSelectedPurchase(purchase);
      setSelectedPurchaseDetails([]);
      setShowPurchaseDetails(true);
      setLoadingPurchaseDetails(true);

      listCompraDetails(purchase.id)
        .then((details) => {
          setSelectedPurchaseDetails(details);
          setLoadingPurchaseDetails(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'No se pudo cargar detalle de la compra.');
          setLoadingPurchaseDetails(false);
        });
    },
    [],
  );

  const closePurchaseDetails = useCallback(() => {
    setShowPurchaseDetails(false);
    setSelectedPurchase(null);
    setSelectedPurchaseDetails([]);
  }, []);

  const refreshDetailsForCurrentPurchase = useCallback(
    async (setError?: (msg: string | null) => void) => {
      const currentId = selectedPurchaseIdRef.current;
      if (showPurchaseDetailsRef.current && currentId) {
        try {
          const details = await listCompraDetails(currentId);
          setSelectedPurchaseDetails(details);
        } catch {
          setError?.('No se pudieron actualizar los detalles de la compra.');
        }
      }
    },
    [],
  );

  return {
    selectedPurchase,
    setSelectedPurchase,
    selectedPurchaseDetails,
    setSelectedPurchaseDetails,
    showPurchaseDetails,
    setShowPurchaseDetails,
    loadingPurchaseDetails,
    selectedPurchaseIdRef,
    showPurchaseDetailsRef,
    openPurchaseDetails,
    closePurchaseDetails,
    refreshDetailsForCurrentPurchase,
  };
}
