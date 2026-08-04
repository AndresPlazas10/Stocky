import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface DeleteSaleModalProps {
  isOpen: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string, options?: any) => string;
}

export function DeleteSaleModal({ isOpen, loading, onCancel, onConfirm, t }: DeleteSaleModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl"
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-xl font-bold">{t('ventas:buttons.deleteSale')}</h3>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-700 font-semibold">
                ⚠️ {t('alerts.confirmDeleteMessage')}
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>{t('alerts.confirmDeleteWarning')}</strong> {t('alerts.saleDeletedStockReverted')}
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  {t('common:buttons.cancel')}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {loading ? t('common:buttons.loading') : t('common:buttons.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
