import { useCallback, useEffect, useState } from 'react';
import { listConfiguracionByBusinessId } from '../../../domain/configuracion/queries';
import type { ConfiguracionSnapshot } from '../../../domain/configuracion/contracts';

interface UseConfiguracionDataParams {
  businessId: string | null;
  businessName: string | null;
  source: 'owner' | 'employee' | null;
  userId: string;
  userEmail: string | null;
}

export function useConfiguracionData({
  businessId,
  businessName,
  source,
  userId,
  userEmail,
}: UseConfiguracionDataParams) {
  const [snapshot, setSnapshot] = useState<ConfiguracionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listConfiguracionByBusinessId({
        businessId,
        businessName,
        source,
        userId,
        userEmail,
      });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [businessId, businessName, source, userId, userEmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadSnapshot();
  }, [loadSnapshot]);

  return {
    snapshot,
    loading,
    error,
    setError,
    loadSnapshot,
  };
}
