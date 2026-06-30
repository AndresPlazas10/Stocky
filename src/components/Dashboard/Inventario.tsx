import type { DashboardModuleProps } from '@/types/components';
import { useMemo } from 'react';
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
      setSuccess('Producto eliminado exitosamente');
    } catch (err) {
      setError(err.message || 'Error al eliminar el producto');
    }
  };

  const handleDeactivateConfirm = async () => {
    try {
      await confirmDeactivate();
      setSuccess('Producto desactivado exitosamente');
    } catch (err) {
      setError(err.message || 'Error al desactivar el producto');
    }
  };

  const handleToggleActive = async (productId, currentStatus) => {
    try {
      await toggleActive(productId, currentStatus);
      setSuccess(`Producto ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
    } catch (err) {
      setError(err.message || 'Error al actualizar el estado del producto');
    }
  };

  const successTitle = useMemo(() => {
    const normalized = String(success || '').toLowerCase();
    if (normalized.includes('eliminad')) return 'Producto eliminado';
    if (normalized.includes('desactivad')) return 'Producto desactivado';
    if (normalized.includes('activad')) return 'Producto activado';
    if (normalized.includes('actualizad')) return 'Producto actualizado';
    if (normalized.includes('cread')) return 'Producto creado';
    return 'Producto guardado';
  }, [success]);

  return (
    <AsyncStateWrapper
      loading={loading}
      error={products.length === 0 ? error : null}
      dataCount={products.length}
      onRetry={loadProducts}
      skeletonType="inventario"
      emptyTitle="No hay productos en inventario"
      emptyDescription="Crea el primer producto para habilitar ventas y compras."
      emptyAction={
        hasAdminPrivileges ? (
          <Button
            type="button"
            onClick={() => setShowForm(true)}
            className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            Crear Primer Producto
          </Button>
        ) : null
      }
      bypassStateRendering={showForm}
      actionProcessing={isSubmitting}
      className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6"
    >
      <div>
        <InventoryHeader hasAdminPrivileges={hasAdminPrivileges} showForm={showForm} onToggleForm={handleToggleForm} />

        <SaleErrorAlert isVisible={!!error} onClose={() => setError('')} title="Error" message={error} duration={5000} />

        <SaleSuccessAlert
          isVisible={!!success}
          onClose={() => setSuccess('')}
          title={successTitle}
          details={[{ label: 'Acción', value: success }]}
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
              <p className="text-gray-500 font-medium text-lg mb-2">No hay productos en el inventario</p>
              <p className="text-gray-400">Haz clic en "Agregar Producto" para comenzar</p>
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
