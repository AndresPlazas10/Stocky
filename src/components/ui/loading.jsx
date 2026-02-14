import { motion } from 'framer-motion';

import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ size = 'md', text = 'Cargando...' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className={`${sizes[size]} text-accent-600 animate-spin`} />
      {text && <p className="text-primary-600 text-sm font-medium">{text}</p>}
    </div>
  );
};

export const LoadingPage = ({ text = 'Cargando...' }) => {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background-50 via-background-100 to-accent-100 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 max-h-[calc(100vh-120px)] overflow-auto"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full gradient-primary opacity-20 animate-ping absolute"></div>
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center relative">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        </div>
        <p className="text-xl font-semibold text-primary-900">{text}</p>
      </motion.div>
    </div>
  );
};

export const LoadingSkeleton = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`skeleton ${className}`}></div>
      ))}
    </>
  );
};

export default LoadingSpinner;
