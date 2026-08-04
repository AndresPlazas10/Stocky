import { useState, useCallback } from 'react';
import { deleteSaleWithDetails } from '@/data/commands/salesCommands';

export function useDeleteSale(
  businessId: string,
  setLoading: (v: boolean) => void,
  setError: (v: string | null) => void,
  loadVentas: (filters?: any, pagination?: any) => Promise<void>,
  currentFilters: any,
  limit: number,
  page: number,
  showSuccess: (title: string, message?: string) => void,
  showError: (title: string, message?: string) => void,
  t: (key: string, options?: any) => string,
) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

  const handleDeleteSale = useCallback((saleId: string) => {
    setSaleToDelete(saleId);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteSale = useCallback(async () => {
    if (!saleToDelete) return;

    setLoading(true);
    setError(null);

    try {
      await deleteSaleWithDetails(saleToDelete, businessId);
      showSuccess(t('ventas:alerts.saleDeleted'), t('ventas:alerts.saleDeletedCorrectly'));
      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });
      setShowDeleteModal(false);
      setSaleToDelete(null);
    } catch (error: any) {
      setError('❌ ' + (error.message || t('ventas:errors.deleteFailed')));
      showError('Error', error.message || t('ventas:errors.deleteFailed'));
      setShowDeleteModal(false);
      setSaleToDelete(null);
    } finally {
      setLoading(false);
    }
  }, [saleToDelete, businessId, loadVentas, currentFilters, limit, page, setLoading, setError, showSuccess, showError, t]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSaleToDelete(null);
  }, []);

  return { showDeleteModal, saleToDelete, handleDeleteSale, confirmDeleteSale, cancelDelete };
}
