import { useCallback, useEffect, useRef, useState } from 'react';
import { listVentaDetails } from '../../../services/ventasService';
import type { VentaDetailRecord, VentaRecord } from '../../../services/ventasService';

export function useVentaDetails() {
  const [selectedVenta, setSelectedVenta] = useState<VentaRecord | null>(null);
  const [selectedVentaDetails, setSelectedVentaDetails] = useState<VentaDetailRecord[]>([]);
  const [loadingVentaDetails, setLoadingVentaDetails] = useState(false);
  const [ventaDetailsError, setVentaDetailsError] = useState<string | null>(null);
  const [showVentaDetails, setShowVentaDetails] = useState(false);

  const selectedVentaIdRef = useRef<string>('');
  const showVentaDetailsRef = useRef(false);
  const ventaDetailsLoadTokenRef = useRef(0);

  useEffect(() => {
    selectedVentaIdRef.current = String(selectedVenta?.id || '').trim();
    showVentaDetailsRef.current = Boolean(showVentaDetails);
  }, [selectedVenta?.id, showVentaDetails]);

  const openVentaDetails = useCallback((venta: VentaRecord) => {
    setSelectedVenta(venta);
    setShowVentaDetails(true);
    setLoadingVentaDetails(true);
    setSelectedVentaDetails([]);
    setVentaDetailsError(null);
    const token = ++ventaDetailsLoadTokenRef.current;

    const loadWithTimeout = async (saleId: string) => {
      const timeoutMs = 12_000;
      return await Promise.race([
        listVentaDetails(saleId),
        new Promise<VentaDetailRecord[]>((_, reject) => {
          setTimeout(
            () => reject(new Error('Tiempo de espera al cargar el detalle de venta.')),
            timeoutMs,
          );
        }),
      ]);
    };

    loadWithTimeout(venta.id)
      .then((details) => {
        if (ventaDetailsLoadTokenRef.current !== token) return;
        setSelectedVentaDetails(details);
        setVentaDetailsError(null);
      })
      .catch((err) => {
        if (ventaDetailsLoadTokenRef.current !== token) return;
        setVentaDetailsError(
          err instanceof Error ? err.message : 'No se pudo cargar el detalle de venta.',
        );
      })
      .finally(() => {
        if (ventaDetailsLoadTokenRef.current === token) {
          setLoadingVentaDetails(false);
        }
      });
  }, []);

  const closeVentaDetails = useCallback(() => {
    ventaDetailsLoadTokenRef.current += 1;
    setShowVentaDetails(false);
    setSelectedVenta(null);
    setSelectedVentaDetails([]);
    setVentaDetailsError(null);
    setLoadingVentaDetails(false);
  }, []);

  const refreshDetailsForCurrentVenta = useCallback(async () => {
    const currentVentaId = selectedVentaIdRef.current;
    if (showVentaDetailsRef.current && currentVentaId) {
      try {
        const details = await listVentaDetails(currentVentaId);
        setSelectedVentaDetails(details);
        setVentaDetailsError(null);
      } catch {
        setVentaDetailsError('No se pudieron actualizar los detalles de la venta.');
      }
    }
  }, []);

  return {
    selectedVenta,
    setSelectedVenta,
    selectedVentaDetails,
    setSelectedVentaDetails,
    loadingVentaDetails,
    ventaDetailsError,
    showVentaDetails,
    setShowVentaDetails,
    selectedVentaIdRef,
    showVentaDetailsRef,
    openVentaDetails,
    closeVentaDetails,
    refreshDetailsForCurrentVenta,
  };
}
