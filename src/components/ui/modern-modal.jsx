import React from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const _motionLintUsage = motion;

export function ModernModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = "md",
  className 
}) {
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-7xl"
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
            onClick={onClose}
            className="fixed inset-0 bg-primary-900/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden",
                sizeClasses[size],
                className
              )}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-accent/20 bg-gradient-to-r from-primary-50 to-accent-50">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-primary-900">
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-accent/20 transition-colors text-primary-700 hover:text-primary-900"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-4 sm:p-6 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="p-4 sm:p-6 border-t border-accent/20 bg-accent-50/30">
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
