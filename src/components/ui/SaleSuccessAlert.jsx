import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';

/**
 * Componente de alerta mejorado para confirmación de ventas
 * Completamente responsive para móvil, tablet y desktop
 */
export function SaleSuccessAlert({ 
  isVisible, 
  onClose,
  title = "✅ Venta Registrada",
  details = [],
  duration = 5000
}) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cierre automático después del tiempo especificado
  React.useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  if (!isMounted || typeof document === 'undefined') return null;

  return createPortal((
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-2 right-2 left-2 sm:left-auto sm:right-4 z-[2147483647] sm:w-96 max-w-sm pointer-events-none"
        >
          {/* Contenedor principal con gradiente */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-2xl overflow-hidden border border-green-300 pointer-events-auto">
            {/* Barra superior con patrón */}
            <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-400" />
            
            <div className="p-3 sm:p-4 text-white">
              {/* Encabezado */}
              <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="flex-shrink-0"
                  >
                    <CheckCircle2 className="w-5 h-5 sm:w-7 sm:h-7" />
                  </motion.div>
                  <h3 className="font-bold text-sm sm:text-lg truncate">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition-colors flex-shrink-0 p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Detalles */}
              {details.length > 0 && (
                <div className="space-y-1 sm:space-y-2 bg-white/10 rounded-md p-2 sm:p-3 backdrop-blur-sm">
                  {details.map((detail, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between text-xs sm:text-sm gap-2 overflow-hidden"
                    >
                      <span className="text-green-50 truncate">{detail.label}</span>
                      <span className="font-semibold text-white truncate text-right">{detail.value}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Barra de progreso */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration, ease: 'linear' }}
                className="origin-left h-1 bg-white/30 mt-2 sm:mt-3 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  ), document.body);
}
