import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Layers } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import type { CloseOrderChoiceModalProps } from '@/types/components';

export function CloseOrderChoiceModal({ isOpen, orderTotal, onPayAllTogether, onSplitBill, onClose }: CloseOrderChoiceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[58] p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
          >
            <Card className="border-0">
              <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                <CardTitle className="text-xl font-bold text-primary-900">
                  Como cerrar la orden?
                </CardTitle>
                <p className="text-sm text-primary-600 mt-1">Total: {formatPrice(orderTotal)}</p>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <Button onClick={onPayAllTogether} className="w-full h-12 gradient-primary text-white hover:opacity-90">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Pagar todo junto
                </Button>
                <Button
                  variant="outline"
                  onClick={onSplitBill}
                  className="w-full h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                >
                  <Layers className="w-5 h-5 mr-2" />
                  Dividir cuenta
                </Button>
                <Button variant="ghost" onClick={onClose} className="w-full h-10 text-primary-600 hover:bg-accent-50">
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
