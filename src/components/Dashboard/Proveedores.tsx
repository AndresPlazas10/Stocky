import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { getSuppliersForManagementPage } from '../../data/queries/suppliersQueries';
import {
  deleteSupplierById,
  saveSupplierWithTaxFallback
} from '../../data/commands/suppliersCommands';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

import { 
  Trash2, 
  Plus, 
  Edit2, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  Search,
  Package,
  AlertTriangle
} from 'lucide-react';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';
import { useLowMotionMode } from '../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../hooks/useProgressiveList.js';
import type { DashboardModuleProps } from '@/types/components';
import { INITIAL_SUPPLIER_FORM } from './proveedores/supplierFormConstants';

const SUPPLIERS_PAGE_SIZE = 50;

function Proveedores({ businessId }: DashboardModuleProps) {
  const { t } = useTranslation('common');
  const config = useBusinessConfig();
  const [suppliers, setSuppliers] = useState<Array<{ id: string; business_name: string; contact_name?: string; email?: string; phone?: string; address?: string; nit?: string; notes?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<{ id: string; business_name: string; contact_name?: string; email?: string; phone?: string; address?: string; nit?: string; notes?: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [supplierTaxColumn, setSupplierTaxColumn] = useState('nit');
  const [page, setPage] = useState(1);
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lowMotionMode = useLowMotionMode();

  const [formData, setFormData] = useState(INITIAL_SUPPLIER_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProveedores = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `proveedores.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []) as Array<{ id: string; business_name: string; contact_name?: string; email?: string; phone?: string; address?: string; nit?: string; notes?: string }> | null;

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setSuppliers(offlineSnapshot);
      setHasMoreSuppliers(false);
      setPage(1);
    }

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const offset = (nextPage - 1) * SUPPLIERS_PAGE_SIZE;
      const { suppliers, taxColumn, hasMore } = await getSuppliersForManagementPage({
        businessId,
        preferredTaxColumn: supplierTaxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset
      });

      if (taxColumn !== supplierTaxColumn) setSupplierTaxColumn(taxColumn);
      const normalizedSuppliers = Array.isArray(suppliers) ? suppliers : [];
      const hasLocalData = normalizedSuppliers.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setSuppliers(offlineSnapshot);
        setHasMoreSuppliers(false);
        setPage(1);
        return;
      }

      setSuppliers((prev) => {
        const nextSuppliers = append ? [...prev, ...normalizedSuppliers] : normalizedSuppliers;
        if (!offline || hasLocalData) {
          saveOfflineSnapshot(offlineSnapshotKey, nextSuppliers);
        }
        return nextSuppliers;
      });
      setHasMoreSuppliers(Boolean(hasMore));
      setPage(nextPage);
    } catch (err) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []) as Array<{ id: string; business_name: string; contact_name?: string; email?: string; phone?: string; address?: string; nit?: string; notes?: string }> | null;
        setSuppliers(Array.isArray(cached) ? cached : []);
        setHasMoreSuppliers(false);
        setPage(1);
      } else {
        setError(`❌ ${t('errors.loadingSuppliers')}: ${(err as Error)?.message || t('errors.unknown')}`);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, supplierTaxColumn, t]);

  useEffect(() => {
    if (businessId) {
      loadProveedores({ nextPage: 1, append: false });
    }
  }, [businessId, loadProveedores]);

  const fetchMoreSuppliers = useCallback(() => {
    if (loadingMore || !hasMoreSuppliers) return;
    loadProveedores({ nextPage: page + 1, append: true });
  }, [hasMoreSuppliers, loadingMore, loadProveedores, page]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      if (!businessId) {
        throw new Error(t('errors.noBusinessDetected'));
      }

      if (!formData.business_name.trim()) {
        throw new Error(t('errors.businessNameRequired'));
      }

      const supplierPayload = {
        business_name: formData.business_name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
        nit: formData.nit || null
      };

      const result = await saveSupplierWithTaxFallback({
        businessId,
        formData: supplierPayload,
        supplierId: editingSupplier?.id || null,
        preferredTaxColumn: supplierTaxColumn
      });
      const { taxColumn } = result;
      if (taxColumn !== supplierTaxColumn) setSupplierTaxColumn(taxColumn);

      setSuccess(editingSupplier ? t('success.updated') : t('success.created'));
      resetForm();
      void result;
      await loadProveedores();
      setShowModal(false);
      
    } catch (err) {
      setError((err as Error).message || t('errors.savingSupplier'));
    } finally {
      setIsSubmitting(false);
    }
  }, [editingSupplier, formData, businessId, loadProveedores, isSubmitting, supplierTaxColumn, t]);

  const handleEdit = useCallback((supplier: typeof editingSupplier) => {
    setEditingSupplier(supplier);
    setFormData({
      business_name: supplier.business_name || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      nit: supplier.nit || '',
      notes: supplier.notes || ''
    });
    setShowModal(true);
  }, []);

  const handleDelete = useCallback((supplierId: string) => {
    setSupplierToDelete(supplierId);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!supplierToDelete) return;

    try {
      try {
        await deleteSupplierById({
          supplierId: supplierToDelete,
          businessId
        });
        loadProveedores();
      } catch (err) {
        if ((err as Record<string, unknown>)?.code === '23503') {
          setError(`❌ ${t('errors.cannotDeleteSupplierWithPurchases')}`);
          setShowDeleteModal(false);
          setSupplierToDelete(null);
          return;
        }
        throw err;
      }

      setSuccess(`✅ ${t('success.deleted')}`);
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch {
      setError(`❌ ${t('errors.deletingSupplier')}`);
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    }
  }, [supplierToDelete, businessId, loadProveedores, t]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  }, []);

  const resetForm = () => {
    setFormData(INITIAL_SUPPLIER_FORM);
    setEditingSupplier(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    let errorTimer: ReturnType<typeof setTimeout>, successTimer: ReturnType<typeof setTimeout>;
    if (error) errorTimer = setTimeout(() => setError(''), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(''), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const search = searchTerm.toLowerCase();
    return suppliers.filter(supplier => 
      supplier.business_name?.toLowerCase().includes(search) ||
      supplier.contact_name?.toLowerCase().includes(search) ||
      supplier.email?.toLowerCase().includes(search) ||
      supplier.nit?.toLowerCase().includes(search)
    );
  }, [suppliers, searchTerm]);

  const canLoadMoreSuppliers = hasMoreSuppliers && !searchTerm.trim();

  const {
    visibleItems: visibleSuppliers,
    hasMore: hasMoreProgressive,
    hasMoreExternal: hasMoreExternal,
    totalCount: totalFilteredSuppliers,
    sentinelRef: suppliersSentinelRef,
    loadMore: loadMoreSuppliers
  } = useProgressiveList(filteredSuppliers, {
    initialCount: lowMotionMode ? 14 : 20,
    step: lowMotionMode ? 14 : 20,
    resetKey: `${businessId}:${searchTerm}:${lowMotionMode ? 'low' : 'full'}`,
    preserveOnGrow: true,
    canLoadMore: canLoadMoreSuppliers,
    loading: loadingMore
  });

  const successTitle = useMemo(() => {
    const normalized = success.toLowerCase();
    if (normalized.includes('eliminad')) return `✨ ${t('success.deleted')}`;
    if (normalized.includes('actualizad')) return `✨ ${t('success.updated')}`;
    if (normalized.includes('cread')) return `✨ ${t('success.created')}`;
    return `✨ ${t('success.saved')}`;
  }, [success, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#C4DFE6]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-accent-500 to-secondary-500 rounded-xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t('navigation.suppliers')}</h1>
                <p className="text-gray-600">{t('messages.manageSuppliersNetwork')}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              {t('buttons.newSupplier')}
            </button>
          </div>
        </motion.div>

        {/* Alertas mejoradas */}
        <SaleErrorAlert 
          isVisible={!!error}
          onClose={() => setError('')}
          title={t('errors.error')}
          message={error}
          duration={5000}
        />

        <SaleSuccessAlert 
          isVisible={!!success}
          onClose={() => setSuccess('')}
          title={successTitle}
          details={[{ label: t('labels.action'), value: success }]}
          duration={5000}
        />

        {/* Barra de búsqueda y estadísticas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('form.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="px-6 py-3 bg-gradient-to-br from-accent-500/10 to-[#C4DFE6]/10 rounded-xl">
                <div className="text-2xl font-bold text-accent-600">{suppliers.length}</div>
                <div className="text-sm text-gray-600">{t('labels.total')}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contenido principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {loading && suppliers.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#C4DFE6] border-t-transparent"></div>
                <p className="text-gray-600">{t('buttons.loading')}</p>
              </div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="p-6 bg-gradient-to-br from-accent-500/10 to-[#C4DFE6]/10 rounded-full mb-6">
                <Package className="w-16 h-16 text-accent-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('empty.noDataToShow')}</h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                {t('empty.noDataAvailable')}
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" />
                {t('empty.createFirst')}
              </button>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Search className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('empty.noResults')}</h3>
              <p className="text-gray-600">{t('empty.noResultsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Vista de tarjetas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {visibleSuppliers.map((supplier, index) => (
                  <motion.div
                    key={supplier.id}
                    initial={lowMotionMode ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
                  >
                    <div className="bg-white rounded-2xl shadow-lg border-2 border-accent-100 hover:border-primary-300 hover:shadow-xl transition-all duration-300">
                      <div className="p-4 sm:p-6">
                        {/* Header con empresa */}
                        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-accent-200">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-3 bg-gradient-to-br from-primary-100 to-accent-100 rounded-xl shrink-0">
                              <Building2 className="w-6 h-6 text-primary-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold text-primary-900 mb-1 break-words">
                                {supplier.business_name}
                              </h3>
                              {supplier.nit && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-accent-100 text-accent-700 rounded-lg text-xs font-medium">
                                  <FileText className="w-3 h-3" />
                                  NIT: {supplier.nit}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleEdit(supplier)}
                              className="p-2 hover:bg-gray-50 text-gray-600 rounded-xl transition-all duration-300 hover:scale-110"
                              title="Editar proveedor"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(supplier.id)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all duration-300 hover:scale-110"
                              title="Eliminar proveedor"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Información de contacto */}
                        <div className="space-y-3">
                          {supplier.contact_name && (
                            <div className="flex items-center gap-3">
                              <User className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">{t('labels.contact')}</p>
                                <p className="text-sm font-medium text-gray-700 truncate">
                                  {supplier.contact_name}
                                </p>
                              </div>
                            </div>
                          )}

                          {supplier.email && (
                            <div className="flex items-center gap-3">
                              <Mail className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">{t('labels.email')}</p>
                                <a 
                                  href={`mailto:${supplier.email}`} 
                                  className="text-sm font-medium text-gray-600 hover:text-gray-700 transition-colors truncate block"
                                >
                                  {supplier.email}
                                </a>
                              </div>
                            </div>
                          )}

                          {supplier.phone && (
                            <div className="flex items-center gap-3">
                              <Phone className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">{t('labels.phone')}</p>
                                <a 
                                  href={`tel:${supplier.phone}`}
                                  className="text-sm font-medium text-gray-700 hover:text-primary-700 transition-colors"
                                >
                                  {supplier.phone}
                                </a>
                              </div>
                            </div>
                          )}

                          {supplier.address && (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">{t('labels.address')}</p>
                                <p className="text-sm font-medium text-gray-700 break-words">
                                  {supplier.address}
                                </p>
                              </div>
                            </div>
                          )}

                          {supplier.notes && (
                            <div className="flex items-start gap-3 pt-3 border-t border-accent-100">
                              <FileText className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">{t('labels.notes')}</p>
                                <p className="text-sm text-gray-600 break-words">
                                  {supplier.notes}
                                </p>
                              </div>
                            </div>
                          )}

                          {!supplier.contact_name && !supplier.email && !supplier.phone && !supplier.address && !supplier.notes && (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-400 italic">
                                {t('empty.noDataAvailable')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {(hasMoreProgressive || (hasMoreExternal && canLoadMoreSuppliers)) && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <p className="text-xs text-gray-500">
                    {t('messages.showingItems', { visible: visibleSuppliers.length, total: totalFilteredSuppliers })}
                  </p>
                  <div ref={suppliersSentinelRef} className="h-2 w-full" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={loadMoreSuppliers}
                    disabled={loadingMore}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {loadingMore ? t('buttons.loading') : t('empty.loadMore')}
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal para crear/editar proveedor */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-3 sm:p-4 overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden my-2 sm:my-0"
            >
              {/* Header del modal */}
              <div className="gradient-primary text-white p-4 sm:p-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    {editingSupplier ? (
                      <Edit2 className="w-8 h-8" />
                    ) : (
                      <Plus className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {editingSupplier ? t('buttons.edit') : t('buttons.newSupplier')}
                    </h2>
                    <p className="text-white/80 mt-1">
                      {editingSupplier ? t('form.updateSupplierInfo') : t('form.completeNewSupplierData')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido del modal */}
              <form onSubmit={handleSubmit} className="max-h-[calc(92vh-96px)] overflow-y-auto">
                <div className="p-4 sm:p-6 space-y-4">
                  
                  {/* Nombre de la empresa */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 text-accent-600" />
                      {t('form.businessName')}
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleChange}
                      placeholder={t('placeholders.supplierExample')}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Fila: Contacto y NIT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4 text-accent-600" />
                        {t('labels.contact')}
                      </label>
                      <input
                        type="text"
                        name="contact_name"
                        value={formData.contact_name}
                        onChange={handleChange}
                        placeholder={t('placeholders.fullNameExample')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-accent-600" />
                        {t('labels.nit')}
                      </label>
                      <input
                        type="text"
                        name="nit"
                        value={formData.nit}
                        onChange={handleChange}
                        placeholder={config.country.taxId.placeholder}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Fila: Email y Teléfono */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Mail className="w-4 h-4 text-accent-600" />
                        {t('form.email')}
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="contacto@empresa.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-4 h-4 text-accent-600" />
                        {t('form.phone')}
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+57 300 123 4567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 text-accent-600" />
                        {t('form.address')}
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Calle 123 #45-67, Bogotá"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-accent-600" />
                        {t('form.notes')}
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Información adicional sobre el proveedor, términos de pago, etc..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="sticky bottom-4 bg-white flex flex-col sm:flex-row gap-2 mt-5 pt-3 pb-2 px-2 sm:px-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                    className="order-2 sm:order-1 w-full sm:flex-1 h-10 sm:h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all duration-300 disabled:opacity-50"
                  >
                    {t('buttons.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="order-1 sm:order-2 w-full sm:flex-1 h-10 sm:h-10 px-4 gradient-primary hover:from-[#99D3DB] hover:to-[#66A5AD] text-white rounded-lg font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                        {t('buttons.loading')}
                      </>
                    ) : (
                      <>
                        {editingSupplier ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {editingSupplier ? t('buttons.update') : t('buttons.createSupplier')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{t('buttons.delete')}</h2>
                    <p className="text-red-100 mt-1">{t('messages.actionCannotBeUndone')}</p>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-700 text-lg mb-4">
                  {t('messages.confirmDeleteSupplier')}
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">{t('messages.important')}:</p>
                      <p>{t('messages.cannotDeleteSupplierWithPurchases')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300"
                  >
                    {t('buttons.cancel')}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    {t('buttons.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Proveedores;
