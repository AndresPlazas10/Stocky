import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CreditCard, Calendar, Phone, Mail } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Modal de advertencia para negocios con pagos pendientes
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {function} onClose - Función para cerrar el modal (solo para admin que quiera continuar bajo su responsabilidad)
 * @param {string} businessName - Nombre del negocio
 */
function PaymentWarningModal({ isOpen, onClose, businessName = 'su negocio' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con advertencia */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
              
              {/* Botón X para cerrar en la esquina */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-20 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-200 group"
                title="Cerrar y continuar usando el sistema"
              >
                <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              </button>
              
              <div className="relative z-10">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm animate-pulse">
                    <AlertTriangle className="w-10 h-10" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-1">
                  ⚠️ Pago Pendiente
                </h1>
                <p className="text-white/90 text-center">
                  {businessName}
                </p>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-5">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg mb-3">
                <div className="flex items-start gap-2">
                  <CreditCard className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-orange-900 text-sm mb-1">
                      No se ha detectado el pago mensual
                    </h3>
                    <p className="text-orange-800 text-sm leading-tight">
                      El servicio de Stocky requiere un pago mensual para mantener activas todas las funcionalidades.
                    </p>
                  </div>
                </div>
              </div>

              {/* Información de contacto */}
              <div className="mb-3">
                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Para regularizar tu situación:
                </h4>
                
                {/* Información de pago */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-green-700" />
                    <h5 className="font-bold text-green-900 text-sm">Método de Pago</h5>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">• Valor:</span>
                      <span className="text-gray-800 font-bold">$50.000 COP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">• Nu (Bre-B):</span>
                      <span className="text-gray-800 font-mono font-bold">@APM331</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">• Titular:</span>
                      <span className="text-gray-800">Andres Felipe</span>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                      <p className="text-xs text-yellow-900 leading-snug">
                        <strong>⚠️ Importante:</strong> Por favor, realice el envío a través de <strong>Bre-B</strong> a la llave <strong>@APM331</strong> y remita una fotografía del comprobante de pago por nuestro canal de WhatsApp, indicando el nombre de su negocio para poder identificarlo correctamente en nuestro sistema.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advertencia adicional */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3">
                <p className="text-red-800 text-xs text-center font-medium leading-snug">
                  ⏰ El servicio de Stocky a su negocio puede ser deshabilitado en los próximos 3 días
                </p>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={onClose}
                  className="w-full h-11 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm"
                >
                  <X className="w-4 h-4" />
                  Cerrar y Continuar Usando el Sistema
                </Button>
                
                <p className="text-xs text-gray-500 text-center leading-snug">
                  Al cerrar podrás seguir usando Stocky. Regulariza el pago para evitar la suspensión.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PaymentWarningModal;
