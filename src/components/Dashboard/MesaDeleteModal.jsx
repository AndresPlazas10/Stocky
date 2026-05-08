import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

export function MesaDeleteModal({ isOpen, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
          >
            <Card className="border-0">
              <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-red-50 to-orange-50">
                <CardTitle className="text-2xl font-bold text-red-900 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  Confirmar Eliminación
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                <p className="text-lg text-primary-700">
                  ¿Estás seguro de que deseas eliminar esta mesa?
                </p>
                <p className="text-sm text-primary-600">
                  Esta acción no se puede deshacer.
                </p>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
