import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Modal optimizado para móvil
 * - Full-screen en móvil
 * - Modal centrado en desktop
 * - Animación slide-up en móvil, fade en desktop
 * - Bloquea scroll del body cuando está abierto
 */
export function MobileModal({ 
  isOpen, 
  onClose, 
  title,
  children,
  footer,
  size = "md", // sm, md, lg, full
  closeButton = true 
}) {
  // Bloquea scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const sizes = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    full: 'sm:max-w-full sm:m-4',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ 
                y: '100%', // Slide from bottom on mobile
                opacity: 0 
              }}
              animate={{ 
                y: 0,
                opacity: 1 
              }}
              exit={{ 
                y: '100%',
                opacity: 0 
              }}
              transition={{ 
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              onClick={(e) => e.stopPropagation()}
              className={`
                w-full bg-white
                flex flex-col
                max-h-[90vh] sm:max-h-[80vh]
                rounded-t-2xl sm:rounded-2xl
                shadow-2xl
                ${sizes[size]}
              `}
            >
              {/* Header */}
              {(title || closeButton) && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 shrink-0">
                  {title && (
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      {title}
                    </h2>
                  )}
                  {closeButton && (
                    <button
                      onClick={onClose}
                      className="p-2 -mr-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      aria-label="Cerrar"
                    >
                      <X size={24} className="text-gray-500" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="px-4 sm:px-6 py-4 border-t border-gray-200 shrink-0">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
