import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X } from 'lucide-react';
import { Button } from './button';
import { getBridgePrinterLabel } from '../../utils/printBridgeClient.js';

export function PrintReceiptConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false
}) {
  const bridgePrinterLabel = getBridgePrinterLabel();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-primary-900/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-accent/20 bg-gradient-to-r from-primary-50 to-accent-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Printer className="w-5 h-5 text-primary-600" />
                  </div>
                  <h2 className="text-lg font-bold text-primary-900">
                    Imprimir comprobante
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

              {/* Content */}
              <div className="p-6">
                <p className="text-primary-700 font-medium mb-2">
                  ¿Deseas imprimir el comprobante de venta?
                </p>
                <p className="text-sm text-accent-600">
                  Se enviará el comprobante a la impresora térmica configurada.
                </p>
                {bridgePrinterLabel && (
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase text-indigo-500">Impresora principal</p>
                    <p className="mt-1 text-sm font-bold text-indigo-950">{bridgePrinterLabel}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-accent/20 bg-accent-50/30 flex gap-3">
                <Button
                  onClick={onCancel}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1 border-accent-200 text-primary-700 hover:bg-accent-100"
                >
                  No
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 gradient-primary text-white hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Sí, imprimir
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
