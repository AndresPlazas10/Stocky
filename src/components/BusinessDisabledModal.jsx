import { motion } from 'framer-motion';
import { Lock, AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Modal bloqueante para negocios deshabilitados por falta de pago
 * Este modal NO se puede cerrar, el usuario debe realizar el pago
 * @param {string} businessName - Nombre del negocio
 * @param {function} onSignOut - Función para cerrar sesión
 */
function BusinessDisabledModal({ businessName = 'su negocio', onSignOut }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[99999] p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header bloqueado */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
          
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                <Lock className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-1">
              🔒 Acceso Bloqueado
            </h1>
            <p className="text-white/90">
              {businessName}
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          <div className="bg-red-50 border-l-4 border-red-600 p-3 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 text-sm mb-1">
                  Servicio Suspendido
                </h3>
                <p className="text-red-800 text-sm leading-tight">
                  El acceso a Stocky ha sido suspendido por falta de pago. Para reactivar su servicio, 
                  debe regularizar el pago pendiente.
                </p>
              </div>
            </div>
          </div>

          {/* Información de pago */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 p-4 rounded-xl mb-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-green-700" />
              <h4 className="font-bold text-green-900 text-sm">Realizar Pago Para Reactivar</h4>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">• Valor:</span>
                <span className="text-gray-800 font-bold">$50.000 COP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">• Nequi:</span>
                <span className="text-gray-800 font-mono font-bold">3176854477</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">• Titular:</span>
                <span className="text-gray-800">StockyPos</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-2">
                <p className="text-xs text-yellow-900 font-medium leading-snug">
                  <strong>⚠️ Importante:</strong> En la descripción de la transferencia escribir{' '}
                  <strong>el nombre de su negocio</strong> para identificar su pago.
                </p>
              </div>
            </div>
          </div>

          {/* Nota importante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-4">
            <p className="text-blue-900 text-xs text-center leading-snug">
              💡 Una vez realizado el pago, su servicio será reactivado en las próximas horas.
            </p>
          </div>

          {/* Botón de salir */}
          <Button
            onClick={onSignOut}
            className="w-full h-11 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg"
          >
            Cerrar Sesión
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default BusinessDisabledModal;
