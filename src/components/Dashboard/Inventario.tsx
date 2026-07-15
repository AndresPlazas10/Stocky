import type { DashboardModuleProps } from '@/types/components';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { useAppToast } from '../../hooks/useAppToast';
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

  const { showError, showSuccess, ToastComponent } = useAppToast();

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
    showSuccess,
    showError,
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
      showSuccess(t('success.deleted'));
    } catch (err) {
      showError(t('errors.general'), err.message || t('errors.deleteFailed'));
    }
  };

  const handleDeactivateConfirm = async () => {
    try {
      await confirmDeactivate();
      showSuccess(t('success.deleted'));
    } catch (err) {
      showError(t('errors.general'), err.message || t('errors.deleteFailed'));
    }
  };

  const handleToggleActive = async (productId, currentStatus) => {
    try {
      await toggleActive(productId, currentStatus);
      showSuccess(`${t('success.updated')} / ${t('status.inactive')}`);
    } catch (err) {
      showError(t('errors.general'), err.message || t('errors.deleteFailed'));
    }
  };

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

        <ToastComponent />
      </div>
    </AsyncStateWrapper>
  );
}

export default Inventario;
