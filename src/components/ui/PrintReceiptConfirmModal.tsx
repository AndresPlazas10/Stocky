import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';
import { Button } from './button';

interface PrintReceiptConfirmModalProps {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onConfirm: (...args: any[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  customerName?: string;
  onCustomerNameChange?: (value: string) => void;
}

export function PrintReceiptConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  customerName,
  onCustomerNameChange,
}: PrintReceiptConfirmModalProps) {
  const { t } = useTranslation('common');
  const resolvedCustomerName = customerName ?? t('form.generalSale');
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-primary-900/80 backdrop-blur-sm z-50"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-accent/20 bg-gradient-to-r from-primary-50 to-accent-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Printer className="w-5 h-5 text-primary-600" />
                  </div>
                  <h2 className="text-lg font-bold text-primary-900">
                    {t('printReceipt.title')}
                  </h2>
                </div>
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-accent/20 transition-colors text-primary-700 hover:text-primary-900 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-primary-700 font-medium mb-2">
                  {t('printReceipt.confirmMessage')}
                </p>
                <p className="text-sm text-accent-600 mb-4">
                  {t('printReceipt.printerNote')}
                </p>
                <div>
                  <label className="block text-xs font-semibold text-accent-600 mb-1 uppercase tracking-wide">
                    {t('printReceipt.customerLabel')}
                  </label>
                  <input
                    type="text"
                    value={resolvedCustomerName}
                    onChange={(e) => onCustomerNameChange?.(e.target.value)}
                    placeholder={t('printReceipt.customerPlaceholder')}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-accent-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-transparent text-primary-900 placeholder-accent-400 transition-all"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-accent/20 bg-accent-50/30 flex gap-3">
                <Button
                  onClick={onCancel}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1 border-accent-200 text-primary-700 hover:bg-accent-100"
                >
                  {t('printReceipt.no')}
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 gradient-primary text-white hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('printReceipt.yes')}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
