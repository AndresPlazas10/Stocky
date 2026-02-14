import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

export function ModernAlert({ type = "info", title, message, onClose, className }) {
  const types = {
    success: {
      bg: "bg-green-50 border-green-200",
      icon: CheckCircle2,
      iconColor: "text-green-600",
      textColor: "text-green-900",
    },
    error: {
      bg: "bg-red-50 border-red-200",
      icon: XCircle,
      iconColor: "text-red-600",
      textColor: "text-red-900",
    },
    warning: {
      bg: "bg-yellow-50 border-yellow-200",
      icon: AlertCircle,
      iconColor: "text-yellow-600",
      textColor: "text-yellow-900",
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: Info,
      iconColor: "text-blue-600",
      textColor: "text-blue-900",
    },
  };

  const config = types[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2",
        config.bg,
        className
      )}
    >
      <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5", config.iconColor)} />
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={cn("text-sm sm:text-base font-semibold mb-1", config.textColor)}>
            {title}
          </h4>
        )}
        <p className={cn("text-xs sm:text-sm", config.textColor)}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn("flex-shrink-0 p-1 rounded-lg hover:bg-black/10", config.textColor)}
        >
          <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}
    </motion.div>
  );
}

export function ModernToast({ isOpen, type, message, onClose, duration = 3000 }) {
  React.useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <ModernAlert type={type} message={message} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
