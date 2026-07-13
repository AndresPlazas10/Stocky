import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import type { DeactivateConfirmModalProps } from '@/types/components';

export function DeactivateConfirmModal({ isOpen, deleteCheckResult, onConfirm, onCancel }: DeactivateConfirmModalProps) {
  const { t } = useTranslation('common');
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="bg-white shadow-2xl rounded-2xl border-none">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{t('errors.deleteFailed')}</h2>
                    <p className="text-orange-100 mt-1">Producto con historial</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700 text-lg">
                  {deleteCheckResult?.has_sales && deleteCheckResult?.has_purchases
                    ? `Este producto tiene ${deleteCheckResult.sales_count} ${t('status.completed')} y ${deleteCheckResult.purchases_count} compras registradas. ${t('errors.deleteFailed')}.`
                    : deleteCheckResult?.has_sales
                      ? `Este producto tiene ${deleteCheckResult.sales_count} ${t('status.completed')} registradas. ${t('errors.deleteFailed')}.`
                      : `Este producto tiene ${deleteCheckResult?.purchases_count || 0} compras registradas. ${t('errors.deleteFailed')}.`}
                </p>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-gray-800 text-sm">
                    <strong>Tip:</strong> Puedes desactivarlo en su lugar. Los productos desactivados no aparecerán en
                    nuevas ventas pero mantendrán su historial.
                  </p>
                </div>

                <p className="text-gray-600">¿Deseas desactivar este producto en lugar de eliminarlo?</p>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={onCancel}
                    className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                  >
                    {t('buttons.cancel')}
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {t('buttons.deactivate')}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
