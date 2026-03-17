import { motion } from 'framer-motion';

import { Lock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

const _motionLintUsage = motion;

/**
 * Modal bloqueante para negocios deshabilitados
 * Este modal NO se puede cerrar, el usuario debe contactar soporte
 * @param {string} businessName - Nombre del negocio
 * @param {function} onSignOut - Función para cerrar sesión
 */
function BusinessDisabledModal({ businessName = 'su negocio', onSignOut }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[99999] p-2 sm:p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col"
      >
        {/* Header bloqueado */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
          
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2.5 bg-white/20 rounded-full backdrop-blur-sm">
                <Lock className="w-10 h-10" />
              </div>
            </div>
            <h1 className="text-xl font-bold mb-1">
              🔒 Acceso Bloqueado
            </h1>
            <p className="text-white/90">
              {businessName}
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5">
          <div className="bg-red-50 border-l-4 border-red-600 p-3 rounded-lg mb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 text-sm mb-1">
                  Servicio Suspendido
                </h3>
                <p className="text-red-800 text-sm leading-tight">
                  El acceso a Stocky ha sido suspendido. Para reactivar el servicio,
                  comunícate con soporte para validar tu cuenta.
                </p>
              </div>
            </div>
          </div>

          {/* Nota importante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
            <p className="text-blue-900 text-xs text-center leading-snug">
              💡 Si ya regularizaste tu cuenta, tu acceso se restablecerá en las próximas horas.
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
