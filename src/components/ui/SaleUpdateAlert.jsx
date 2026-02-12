import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

/**
 * Componente de alerta para actualizaciones (color amarillo suave)
 * Completamente responsive para móvil, tablet y desktop
 */
export function SaleUpdateAlert({ 
  isVisible, 
  onClose,
  title = "✨ Actualizado",
  details = [],
  duration = 5000
}) {
  React.useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-2 right-2 left-2 sm:left-auto sm:right-4 z-50 sm:w-96 max-w-sm"
        >
          {/* Contenedor principal con gradiente amarillo suave */}
          <div className="bg-gradient-to-r from-amber-400 to-yellow-400 rounded-lg shadow-2xl overflow-hidden border border-amber-300">
            {/* Barra superior */}
            <div className="h-1 bg-gradient-to-r from-amber-300 to-yellow-300" />
            
            <div className="p-3 sm:p-4 text-amber-950">
              {/* Encabezado */}
              <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="flex-shrink-0"
                  >
                    <AlertCircle className="w-5 h-5 sm:w-7 sm:h-7" />
                  </motion.div>
                  <h3 className="font-bold text-sm sm:text-lg truncate">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-amber-700 hover:text-amber-950 transition-colors flex-shrink-0 p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Detalles */}
              {details.length > 0 && (
                <div className="space-y-1 sm:space-y-2 bg-white/20 rounded-md p-2 sm:p-3 backdrop-blur-sm">
                  {details.map((detail, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between text-xs sm:text-sm gap-2 overflow-hidden"
                    >
                      <span className="text-amber-900 truncate">{detail.label}</span>
                      <span className="font-semibold text-amber-950 truncate text-right">{detail.value}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Barra de progreso */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration, ease: 'linear' }}
                className="origin-left h-1 bg-amber-900/20 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
