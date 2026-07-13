import type { DashboardModuleProps } from '@/types/components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { useInventoryProducts } from './inventario/useInventoryProducts.js';
import { useInventoryCrud } from './inventario/useInventoryCrud.js';
import { InventoryHeader } from './inventario/InventoryHeader.jsx';
import { InventoryGrid } from './inventario/InventoryGrid.jsx';
import { ProductFormModal } from './inventario/ProductFormModal.jsx';
import { DeleteConfirmModal } from './inventario/DeleteConfirmModal.jsx';
import { DeactivateConfirmModal } from './inventario/DeactivateConfirmModal.jsx';

function Inventario({ businessId, userRole = 'admin' }: DashboardModuleProps) {
  const { t } = useTranslation('common');
  const {
    products,
    suppliers,
    loading,
    error,
    setError,
    success,
    setSuccess,
    isEmployee,
    hasAdminPrivileges,
    visibleProducts,
    canLoadMoreProducts,
    totalProducts,
    productsSentinelRef,
    loadingMoreProducts,
    loadMoreProducts,
    loadProducts,
    setProductsWithSnapshot,
  } = useInventoryProducts(businessId, userRole);

  const {
    formData,
    showForm,
    setShowForm,
    editingProduct,
    showEditModal,
    setShowEditModal,
    isSubmitting,
    generatedCode,
    showDeleteModal,
    showDeactivateModal,
    deleteCheckResult,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    confirmDelete,
    confirmDeactivate,
    cancelDelete,
    toggleActive,
    resetForm,
  } = useInventoryCrud({
    businessId,
    loadProducts,
    setProductsWithSnapshot,
    hasAdminPrivileges,
    isEmployee,
  });

  const handleToggleForm = () => {
    if (showForm) {
      setShowForm(false);
      resetForm();
    } else {
      setShowForm(true);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const handleEditCancel = () => {
    setShowEditModal(false);
    resetForm();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    handleSubmit(e);
  };

  const handleDeleteConfirm = async () => {
    try {
      await confirmDelete();
      setSuccess(t('success.deleted'));
    } catch (err) {
      setError(err.message || t('errors.deleteFailed'));
    }
  };

  const handleDeactivateConfirm = async () => {
    try {
      await confirmDeactivate();
      setSuccess(t('success.deleted'));
    } catch (err) {
      setError(err.message || t('errors.deleteFailed'));
    }
  };

  const handleToggleActive = async (productId, currentStatus) => {
    try {
      await toggleActive(productId, currentStatus);
      setSuccess(`${t('success.updated')} / ${t('status.inactive')}`);
    } catch (err) {
      setError(err.message || t('errors.deleteFailed'));
    }
  };

  const successTitle = useMemo(() => {
    const normalized = String(success || '').toLowerCase();
    if (normalized.includes('eliminad')) return t('success.deleted');
    if (normalized.includes('desactivad')) return t('success.deleted');
    if (normalized.includes('activad')) return t('success.updated');
    if (normalized.includes('actualizad')) return t('success.updated');
    if (normalized.includes('cread')) return t('success.created');
    return t('success.saved');
  }, [success, t]);

  return (
    <AsyncStateWrapper
      loading={loading}
      error={products.length === 0 ? error : null}
      dataCount={products.length}
      onRetry={loadProducts}
      skeletonType="inventario"
      emptyTitle={t('empty.noDataToShow')}
      emptyDescription={t('empty.noDataAvailable')}
      emptyAction={
        hasAdminPrivileges ? (
          <Button
            type="button"
            onClick={() => setShowForm(true)}
            className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            {t('empty.createFirst')}
          </Button>
        ) : null
      }
      bypassStateRendering={showForm}
      actionProcessing={isSubmitting}
      className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6"
    >
      <div>
        <InventoryHeader hasAdminPrivileges={hasAdminPrivileges} showForm={showForm} onToggleForm={handleToggleForm} />

        <SaleErrorAlert isVisible={!!error} onClose={() => setError('')} title={t('errors.general')} message={error} duration={5000} />

        <SaleSuccessAlert
          isVisible={!!success}
          onClose={() => setSuccess('')}
          title={successTitle}
          details={[{ label: t('labels.action'), value: success }]}
          duration={5000}
        />

        <ProductFormModal
          mode={editingProduct ? 'edit' : 'create'}
          isOpen={showForm || showEditModal}
          formData={formData}
          onChange={handleChange}
          onSubmit={showEditModal ? handleEditSubmit : handleSubmit}
          on_cancel={showEditModal ? handleEditCancel : handleFormCancel}
          isSubmitting={isSubmitting}
          generatedCode={generatedCode}
          suppliers={suppliers}
        />

        <InventoryGrid
          visibleProducts={visibleProducts}
          totalProducts={totalProducts}
          canLoadMoreProducts={canLoadMoreProducts}
          productsSentinelRef={productsSentinelRef}
          loadingMoreProducts={loadingMoreProducts}
          loadMoreProducts={loadMoreProducts}
          lowMotionMode={false}
          hasAdminPrivileges={hasAdminPrivileges}
          isEmployee={isEmployee}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />

        {products.length === 0 && !loading && (
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium text-lg mb-2">{t('empty.noDataToShow')}</p>
              <p className="text-gray-400">{t('empty.noDataAvailable')}</p>
            </div>
          </Card>
        )}

        <DeleteConfirmModal isOpen={showDeleteModal} onConfirm={handleDeleteConfirm} onCancel={cancelDelete} />

        <DeactivateConfirmModal
          isOpen={showDeactivateModal}
          deleteCheckResult={deleteCheckResult}
          onConfirm={handleDeactivateConfirm}
          onCancel={cancelDelete}
        />
      </div>
    </AsyncStateWrapper>
  );
}

export default Inventario;
