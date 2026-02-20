import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, X, Edit, Package, Save, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice } from '../../utils/formatters.js';
import {
  COMBO_STATUS,
  createCombo,
  deleteCombo,
  fetchCombos,
  updateCombo
} from '../../services/combosService.js';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';

const EMPTY_ITEM = { producto_id: '', cantidad: 1 };

const createInitialForm = () => ({
  nombre: '',
  precio_venta: '',
  descripcion: '',
  estado: COMBO_STATUS.ACTIVE,
  items: [{ ...EMPTY_ITEM }]
});

// eslint helper: `no-unused-vars` no detecta consistentemente `<motion.* />` en esta config.
const _motionLintUsage = motion;

function getComboDisplayProducts(combo) {
  const items = Array.isArray(combo?.combo_items) ? combo.combo_items : [];
  if (items.length === 0) return 'Sin productos';

  const formatted = items
    .map((item) => `${item.cantidad} x ${item.products?.name || 'Producto'}`)
    .join(', ');

  if (formatted.length <= 110) return formatted;
  return `${formatted.slice(0, 107)}...`;
}

export default function Combos({ businessId }) {
  const [combos, setCombos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [comboToDelete, setComboToDelete] = useState(null);
  const [formData, setFormData] = useState(createInitialForm());

  const productosById = useMemo(() => {
    const map = new Map();
    (productos || []).forEach((producto) => {
      map.set(producto.id, producto);
    });
    return map;
  }, [productos]);

  const loadProductos = useCallback(async () => {
    if (!businessId) return [];

    const { data, error: productsError } = await supabase
      .from('products')
      .select('id, name, code, stock, sale_price, is_active')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(500);

    if (productsError) {
      throw new Error(productsError.message || 'No se pudieron cargar los productos');
    }

    return data || [];
  }, [businessId]);

  const loadData = useCallback(async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const [loadedCombos, loadedProducts] = await Promise.all([
        fetchCombos(businessId),
        loadProductos()
      ]);

      setCombos(loadedCombos || []);
      setProductos(loadedProducts || []);
      setError(null);
    } catch (err) {
      setError(`❌ ${err?.message || 'No se pudieron cargar los combos'}`);
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, loadProductos]);

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

  const openEditModal = (combo) => {
    setEditingCombo(combo);
    setFormData({
      nombre: combo?.nombre || '',
      precio_venta: combo?.precio_venta ?? '',
      descripcion: combo?.descripcion || '',
      estado: combo?.estado || COMBO_STATUS.ACTIVE,
      items: (combo?.combo_items || []).length > 0
        ? combo.combo_items.map((item) => ({
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

  const handleRemoveItemRow = (index) => {
    setFormData((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index)
      };
    });
  };

  const handleItemChange = (index, field, value) => {
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

  const handleSubmit = async (event) => {
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
      };

      if (editingCombo?.id) {
        await updateCombo(editingCombo.id, businessId, payload);
        setSuccess('✅ Combo actualizado correctamente');
      } else {
        await createCombo(businessId, payload);
        setSuccess('✅ Combo creado correctamente');
      }

      closeFormModal();
      await loadData();
    } catch (err) {
      setError(`❌ ${err?.message || 'No se pudo guardar el combo'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (combo) => {
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
      setSuccess(`✅ Combo "${comboToDelete.nombre}" eliminado correctamente`);
      closeDeleteModal();
      await loadData();
    } catch (err) {
      setError(`❌ ${err?.message || 'No se pudo eliminar el combo'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    if (!success && !error) return undefined;
    const timer = setTimeout(clearMessages, 5000);
    return () => clearTimeout(timer);
  }, [success, error, clearMessages]);

  return (
    <AsyncStateWrapper
      loading={loading}
      error={combos.length === 0 ? error : null}
      dataCount={combos.length}
      onRetry={loadData}
      skeletonType="inventario"
      emptyTitle="No hay combos creados"
      emptyDescription="Crea tu primer combo para vender conjuntos de productos con descuento de inventario interno."
      emptyAction={
        <Button
          type="button"
          onClick={openCreateModal}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Crear Primer Combo
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
                  <h1 className="text-2xl sm:text-3xl font-bold">Combos</h1>
                  <p className="text-white/80 mt-1 text-sm sm:text-base">Gestiona combos estructurados de productos</p>
                </div>
              </div>
              <Button
                onClick={openCreateModal}
                className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Nuevo Combo
              </Button>
            </div>
          </Card>
        </motion.div>

        <AnimatePresence>
          <SaleSuccessAlert
            isVisible={!!success}
            onClose={() => setSuccess(null)}
            title={success || '✨ Operación exitosa'}
            details={[]}
            duration={5000}
          />
          <SaleErrorAlert
            isVisible={!!error}
            onClose={() => setError(null)}
            title="❌ Error"
            message={error || ''}
            details={[]}
            duration={7000}
          />
        </AnimatePresence>

        <Card className="shadow-xl rounded-2xl bg-white border-none">
          <div className="p-4 sm:p-6">
            {combos.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Layers className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-lg">No hay combos registrados</p>
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
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{combo.descripcion || 'Sin descripción'}</p>
                          </div>
                          <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg bg-accent-50 p-2">
                            <p className="text-accent-600 text-xs uppercase">Precio</p>
                            <p className="font-bold text-primary-900">{formatPrice(combo.precio_venta)}</p>
                          </div>
                          <div className="rounded-lg bg-blue-50 p-2">
                            <p className="text-blue-700 text-xs uppercase">Productos</p>
                            <p className="font-bold text-blue-900">{combo.combo_items?.length || 0}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700">
                          <p className="font-medium mb-1 text-gray-800">Composición</p>
                          <p>{getComboDisplayProducts(combo)}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Button
                            onClick={() => openEditModal(combo)}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            onClick={() => openDeleteModal(combo)}
                            className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
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
                  <h3 className="text-xl font-bold text-gray-800">Eliminar Combo</h3>
                  <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
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
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmDeleteCombo}
                  disabled={isDeleting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-xl"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
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
                    {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
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
                    <label className="block text-sm font-semibold text-primary-700 mb-2">Nombre del combo *</label>
                    <Input
                      value={formData.nombre}
                      onChange={(event) => setFormData((prev) => ({ ...prev, nombre: event.target.value }))}
                      placeholder="Ej: Cubetazo"
                      className="h-11 border-accent-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primary-700 mb-2">Precio de venta *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(event) => setFormData((prev) => ({ ...prev, precio_venta: event.target.value }))}
                      placeholder="Ej: 25000"
                      className="h-11 border-accent-300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-primary-700 mb-2">Descripción (opcional)</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(event) => setFormData((prev) => ({ ...prev, descripcion: event.target.value }))}
                    placeholder="Descripción del combo"
                    className="w-full min-h-[90px] rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all p-3"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-primary-700">Productos del combo *</label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddItemRow}
                      className="border-accent-300 text-accent-700 hover:bg-accent-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar producto
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
                            <option value="">Selecciona un producto</option>
                            {(productos || []).map((producto) => {
                              const optionValue = String(producto.id);
                              const isAlreadySelected = selectedProductIds.has(optionValue) && optionValue !== selectedCurrent;
                              if (isAlreadySelected) return null;
                              return (
                                <option key={producto.id} value={producto.id}>
                                  {producto.name} ({producto.code || 'Sin código'}) - Stock: {producto.stock}
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
                            placeholder="Cantidad"
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
                    <p className="text-sm text-red-600 mt-2">No se permiten productos repetidos en el combo.</p>
                  )}
                </div>

                {formData.items.length > 0 && (
                  <div className="rounded-xl border border-accent-200 bg-accent-50 p-3">
                    <p className="text-sm font-semibold text-primary-800 mb-2">Resumen de composición</p>
                    <div className="space-y-1 text-sm text-primary-700">
                      {formData.items.map((item, index) => {
                        const product = productosById.get(item.producto_id);
                        const quantity = Number(item.cantidad);
                        return (
                          <p key={`summary-${index}`}>
                            {Number.isFinite(quantity) && quantity > 0 ? quantity : 0} x {product?.name || 'Producto sin seleccionar'}
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
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || hasDuplicateProducts}
                    className="flex-1 h-11 gradient-primary text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      'Guardando...'
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingCombo ? 'Guardar cambios' : 'Crear combo'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AsyncStateWrapper>
  );
}
