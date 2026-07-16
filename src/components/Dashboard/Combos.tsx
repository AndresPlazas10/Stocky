import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, X, Edit, Package, Save, Trash2, AlertCircle } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { getProductsForCombos } from '../../data/queries/combosQueries';
import {
  COMBO_STATUS,
  createCombo,
  deleteCombo,
  fetchCombos,
  updateCombo
} from '../../services/combosService';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAppToast } from '../../hooks/useAppToast';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import type { DashboardModuleProps } from '@/types/components';

const EMPTY_ITEM = { producto_id: '', cantidad: 1 };

const createInitialForm = () => ({
  nombre: '',
  precio_venta: '',
  descripcion: '',
  estado: COMBO_STATUS.ACTIVE,
  items: [{ ...EMPTY_ITEM }]
});

function getComboDisplayProducts(combo: { combo_items?: Array<{ cantidad: number; products?: { name?: string } }> }, t: (key: string) => string) {
  const items = Array.isArray(combo?.combo_items) ? combo.combo_items : [];
  if (items.length === 0) return t('form.noDescription');

  const formatted = items
    .map((item) => `${item.cantidad} x ${item.products?.name || 'Producto'}`)
    .join(', ');

  if (formatted.length <= 110) return formatted;
  return `${formatted.slice(0, 107)}...`;
}

export default function Combos({ businessId }: DashboardModuleProps) {
  const { t } = useTranslation('common');
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  
  const [combos, setCombos] = useState<Array<{ id: string; nombre: string; precio_venta: number; descripcion?: string; estado: string; combo_items?: Array<{ producto_id: string; cantidad: number; products?: { name?: string } }> }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; code?: string; stock: number; manage_stock: boolean }>>([]);
  const { showError, showSuccess, ToastComponent } = useAppToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingCombo, setEditingCombo] = useState<{ id: string; nombre: string; precio_venta: number; descripcion?: string; estado: string; combo_items?: Array<{ producto_id: string; cantidad: number; products?: { name?: string } }> } | null>(null);
  const [comboToDelete, setComboToDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [formData, setFormData] = useState(createInitialForm());

  const productsById = useMemo(() => {
    const map = new Map();
    (products || []).forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const loadProducts = useCallback(async () => {
    if (!businessId) return [];

    return getProductsForCombos(businessId);
  }, [businessId]);

  const loadData = useCallback(async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const [loadedCombos, loadedProducts] = await Promise.all([
        fetchCombos(businessId),
        loadProducts()
      ]);

      setCombos((loadedCombos || []) as any);
      setProducts(loadedProducts || []);
      setError(null);
    } catch (err) {
      setError(`❌ ${(err as Error)?.message || t('combos.errors.loadFailed')}`);
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, loadProducts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setEditingCombo(null);
    setFormData(createInitialForm());
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    resetForm();
  }, [resetForm]);

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (combo: typeof editingCombo) => {
    setEditingCombo(combo);
    setFormData({
      nombre: combo?.nombre || '',
      precio_venta: (combo?.precio_venta ?? '') as any,
      descripcion: combo?.descripcion || '',
      estado: (combo?.estado || COMBO_STATUS.ACTIVE) as any,
      items: (combo?.combo_items || []).length > 0
        ? combo!.combo_items!.map((item) => ({
            producto_id: item.producto_id,
            cantidad: Number(item.cantidad || 1)
          }))
        : [{ ...EMPTY_ITEM }]
    });
    setShowFormModal(true);
  };

  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }]
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    setFormData((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index)
      };
    });
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              [field]: field === 'cantidad' ? value : value
            }
          : item
      ))
    }));
  };

  const hasDuplicateProducts = useMemo(() => {
    const seen = new Set();
    for (const item of formData.items) {
      const productId = String(item?.producto_id || '').trim();
      if (!productId) continue;
      if (seen.has(productId)) return true;
      seen.add(productId);
    }
    return false;
  }, [formData.items]);

  const selectedProductIds = useMemo(() => {
    return new Set(
      formData.items
        .map((item) => String(item?.producto_id || '').trim())
        .filter(Boolean)
    );
  }, [formData.items]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        nombre: formData.nombre,
        precio_venta: formData.precio_venta,
        descripcion: formData.descripcion,
        estado: formData.estado,
        items: formData.items.map((item) => ({
          producto_id: item.producto_id,
          cantidad: Number(item.cantidad)
        }))
      } as any;

      if (editingCombo?.id) {
        await updateCombo(editingCombo.id, businessId, payload);
        showSuccess('Éxito', t('combosSection.messages.savedSuccessfully'));
      } else {
        await createCombo(businessId, payload);
        showSuccess('Éxito', t('combosSection.messages.savedSuccessfully'));
      }

      closeFormModal();
      await loadData();
    } catch (err) {
      showError('Error', (err as Error)?.message || t('combosSection.errors.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (combo: typeof comboToDelete) => {
    setComboToDelete(combo);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setComboToDelete(null);
  };

  const confirmDeleteCombo = async () => {
    if (!comboToDelete?.id || isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);
      await deleteCombo(comboToDelete.id, businessId);
      showSuccess('Éxito', t('combosSection.messages.deletedSuccessfully'));
      closeDeleteModal();
      await loadData();
    } catch (err) {
      showError('Error', (err as Error)?.message || t('combosSection.errors.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AsyncStateWrapper
      loading={loading}
      error={combos.length === 0 ? error : null}
      dataCount={combos.length}
      onRetry={loadData}
      skeletonType="inventario"
      emptyTitle={t('empty.noDataToShow')}
      emptyDescription={t('empty.combosDescription')}
      emptyAction={
        <Button
          type="button"
          onClick={openCreateModal}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          {t('empty.createFirst')}
        </Button>
      }
      bypassStateRendering={showFormModal}
      className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="gradient-primary text-white shadow-xl rounded-2xl border-none">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Layers className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{t('navigation.combos')}</h1>
                  <p className="text-white/80 mt-1 text-sm sm:text-base">Gestiona combos estructurados de productos</p>
                </div>
              </div>
              <Button
                onClick={openCreateModal}
                className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('buttons.newCombo')}
              </Button>
            </div>
          </Card>
        </motion.div>

        <Card className="shadow-xl rounded-2xl bg-white border-none">
          <div className="p-4 sm:p-6">
            {combos.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Layers className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-lg">{t('empty.noDataToShow')}</p>
                <p className="text-sm mt-1">Crea el primero con el botón "Nuevo Combo"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {combos.map((combo) => {
                  const isActive = combo.estado === COMBO_STATUS.ACTIVE;
                  return (
                    <Card key={combo.id} className="rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300">
                      <div className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-accent-600 text-lg truncate">{combo.nombre}</p>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{combo.descripcion || t('form.noDescription')}</p>
                          </div>
                          <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}>
                            {isActive ? t('status.active') : t('status.inactive')}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-center">
                          <div className="rounded-lg bg-accent-50 p-2">
                            <p className="text-accent-600 text-xs uppercase">{t('form.price')}</p>
                            <p className="font-bold text-primary-900">{fmtPrice(combo.precio_venta)}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-2">
                            <p className="text-gray-700 text-xs uppercase">{t('labels.product')}</p>
                            <p className="font-bold text-gray-900">{combo.combo_items?.length || 0}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700">
                          <p className="font-medium mb-1 text-gray-800">{t('form.description')}</p>
                          <p>{getComboDisplayProducts(combo, t)}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Button
                            onClick={() => openEditModal(combo)}
                            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            {t('buttons.edit')}
                          </Button>
                          <Button
                            onClick={() => openDeleteModal(combo)}
                            className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('buttons.delete')}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeDeleteModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{t('buttons.delete')}</h3>
                  <p className="text-sm text-gray-600">{t('messages.actionCannotBeUndone')}</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                ¿Seguro que deseas eliminar el combo{' '}
                <span className="font-semibold text-gray-900">"{comboToDelete?.nombre || 'seleccionado'}"</span>?
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="flex-1 h-11 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
                >
                  {t('buttons.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteCombo}
                  disabled={isDeleting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                >
                  {isDeleting ? t('buttons.loading') : t('buttons.delete')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFormModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={closeFormModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="gradient-primary p-4 sm:p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
                    {editingCombo ? t('buttons.edit') : t('buttons.newCombo')}
                  </h2>
                </div>
                <button
                  onClick={closeFormModal}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[calc(92vh-80px)] space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-primary-700 mb-2">{t('form.name')}</label>
                    <Input
                      value={formData.nombre}
                      onChange={(event) => setFormData((prev) => ({ ...prev, nombre: event.target.value }))}
                      placeholder={t('placeholders.comboNameExample')}
                      className="h-11 border-accent-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primary-700 mb-2">{t('form.price')}</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(event) => setFormData((prev) => ({ ...prev, precio_venta: event.target.value }))}
                      placeholder={t('placeholders.priceExample')}
                      className="h-11 border-accent-300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-700 mb-2">{t('form.description')}</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(event) => setFormData((prev) => ({ ...prev, descripcion: event.target.value }))}
                    placeholder={t('placeholders.comboDescription')}
                    className="w-full min-h-[90px] rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all p-3"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-primary-700">{t('labels.product')}</label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddItemRow}
                      className="border-accent-300 text-accent-700 hover:bg-accent-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('buttons.add')}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formData.items.map((item, index) => {
                      const selectedCurrent = String(item?.producto_id || '').trim();
                      return (
                        <div key={`combo-item-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_140px_44px] gap-2 items-start">
                          <select
                            value={item.producto_id}
                            onChange={(event) => handleItemChange(index, 'producto_id', event.target.value)}
                            className="h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                            required
                          >
                            <option value="">{t('form.selectProduct')}</option>
                            {(products || []).map((product) => {
                              const optionValue = String(product.id);
                              const isAlreadySelected = selectedProductIds.has(optionValue) && optionValue !== selectedCurrent;
                              if (isAlreadySelected) return null;
                              return (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.code || t('form.noCode')}){product.manage_stock !== false ? ` - Stock: ${product.stock}` : ''}
                                </option>
                              );
                            })}
                          </select>

                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            value={item.cantidad}
                            onChange={(event) => handleItemChange(index, 'cantidad', event.target.value)}
                            placeholder={t('placeholders.quantity')}
                            className="h-11 border-accent-300"
                            required
                          />

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleRemoveItemRow(index)}
                            disabled={formData.items.length <= 1}
                            className="h-11 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {hasDuplicateProducts && (
                    <p className="text-sm text-red-600 mt-2">{t('errors.requiredField')}</p>
                  )}
                </div>

                {formData.items.length > 0 && (
                  <div className="rounded-xl border border-accent-200 bg-accent-50 p-3">
                    <p className="text-sm font-semibold text-primary-800 mb-2">{t('form.description')}</p>
                    <div className="space-y-1 text-sm text-primary-700 text-center">
                      {formData.items.map((item, index) => {
                        const product = productsById.get(item.producto_id);
                        const quantity = Number(item.cantidad);
                        return (
                          <p key={`summary-${index}`}>
                            {Number.isFinite(quantity) && quantity > 0 ? quantity : 0} x {product?.name || t('form.selectProduct')}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeFormModal}
                    className="flex-1 h-11 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                  >
                  {t('buttons.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || hasDuplicateProducts}
                    className="flex-1 h-11 gradient-primary text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      t('buttons.loading')
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingCombo ? t('buttons.saveChanges') : t('buttons.createCombo')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastComponent />
    </AsyncStateWrapper>
  );
}
