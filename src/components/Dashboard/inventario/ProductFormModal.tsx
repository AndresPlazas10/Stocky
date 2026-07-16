import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  X,
  Box,
  BarChart3,
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  Building2,
  AlertCircle,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { PRODUCT_CATEGORIES } from './productFormConstants';
import type { ProductFormModalProps } from '@/types/components';

export function ProductFormModal({
  mode,
  isOpen,
  formData,
  onChange,
  onSubmit,
  on_cancel,
  isSubmitting,
  generatedCode,
  suppliers,
}: ProductFormModalProps) {
  const { t } = useTranslation('common');
  const isEdit = mode === 'edit';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={on_cancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div
              className={`p-6 flex justify-between items-center ${
                isEdit
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700'
                  : 'gradient-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {isEdit ? (
                    <span className="text-white text-lg font-bold">✎</span>
                  ) : (
                    <Plus className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {isEdit ? t('buttons.edit') : t('buttons.add')}
                  </h2>
                  {isEdit && generatedCode && (
                    <p className="text-gray-100 text-sm mt-1">{t('labels.code')}: {generatedCode}</p>
                  )}
                </div>
              </div>
              <button
                onClick={on_cancel}
                className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(95vh-88px)]">
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Box className="w-4 h-4" />
                      {t('form.name')} *
                    </label>
                    <Input
                      name="name"
                      type="text"
                      placeholder="Ej: Laptop HP"
                      value={formData.name}
                      onChange={onChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      {t('form.category')} *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={onChange}
                      required
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#66A5AD] focus:ring-[#66A5AD] transition-all duration-300"
                    >
                      <option value="">{t('form.category')}</option>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {t(cat.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        {t('form.kitchenReceiptNote')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {t('form.price')} *
                    </label>
                    <Input
                      name="purchase_price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={onChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {t('form.price')} *
                    </label>
                    <Input
                      name="sale_price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.sale_price}
                      onChange={onChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                      <span className="text-sm font-medium text-gray-800">{t('form.manageStock')}</span>
                      <input
                        name="manage_stock"
                        type="checkbox"
                        checked={formData.manage_stock !== false}
                        onChange={onChange}
                        className="h-4 w-4 rounded border-gray-300 text-[#66A5AD] focus:ring-[#66A5AD]"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {isEdit ? t('form.stock') : `${t('form.stock')} ${formData.manage_stock !== false ? '*' : '(deshabilitado)'}`}
                    </label>
                    {isEdit ? (
                      <div className="h-11 px-4 rounded-xl border border-gray-300 bg-gray-100 flex items-center">
                        <span className="text-gray-500">
                          {formData.manage_stock === false ? t('form.stock') : formData.stock}
                        </span>
                      </div>
                    ) : (
                      <Input
                        name="stock"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.stock}
                        onChange={onChange}
                        required={formData.manage_stock !== false}
                        disabled={formData.manage_stock === false}
                        className="h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD] disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    )}
                    {isEdit ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.manage_stock !== false
                          ? 'El stock se modifica con compras/ventas'
                          : 'No se valida ni descuenta inventario al vender'}
                      </p>
                    ) : formData.manage_stock !== false ? (
                      <p className="text-xs text-gray-500 mt-1">Alerta cuando el stock baje de este nivel</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">No aplica cuando no se controla inventario</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {t('form.minStock')}
                    </label>
                    <Input
                      name="min_stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.min_stock}
                      onChange={onChange}
                      disabled={formData.manage_stock === false}
                      className="h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.stock')}</label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={onChange}
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#66A5AD] focus:ring-[#66A5AD] transition-all duration-300"
                    >
                      <option value="unit">{t('units.unit')}</option>
                      <option value="kg">{t('units.kg')}</option>
                      <option value="l">{t('units.l')}</option>
                      <option value="box">{t('units.box')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {t('form.supplier')}
                  </label>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={onChange}
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#66A5AD] focus:ring-[#66A5AD] transition-all duration-300"
                  >
                    <option value="">{t('form.supplier')}</option>
                    {suppliers.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.business_name || prov.contact_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sticky bottom-4 bg-white flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5 pt-3 pb-2 px-1 sm:px-0 border-t border-gray-200">
                  <Button
                    type="button"
                    onClick={on_cancel}
                    className="order-2 sm:order-1 w-full sm:flex-1 h-10 sm:h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl border-none font-medium text-sm sm:text-base"
                  >
                    {t('buttons.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={`order-1 sm:order-2 w-full sm:flex-1 h-10 sm:h-12 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base ${
                      isEdit
                        ? 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'
                        : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isEdit ? t('buttons.loading') : t('buttons.loading')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {isEdit ? t('buttons.save') : t('buttons.save')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
