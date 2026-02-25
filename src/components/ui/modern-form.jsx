import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const _motionLintUsage = motion;

export function ModernButton({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  const variants = {
    primary: "bg-gradient-to-r from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white shadow-lg hover:shadow-xl",
    secondary: "bg-gradient-to-r from-accent-500 to-accent-700 hover:from-accent-600 hover:to-accent-800 text-white shadow-lg hover:shadow-xl",
    outline: "border-2 border-primary-600 text-primary-900 hover:bg-primary-50",
    ghost: "text-primary-900 hover:bg-accent/10",
    danger: "bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white shadow-lg hover:shadow-xl",
    success: "bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white shadow-lg hover:shadow-xl",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs sm:text-sm",
    md: "px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base",
    lg: "px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      )}
      {children}
    </motion.button>
  );
}

export function ModernInput({
  label,
  error,
  icon: Icon,
  className,
  containerClassName,
  ...props
}) {
  return (
    <div className={cn("space-y-1 sm:space-y-2", containerClassName)}>
      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-primary-900">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-primary-400">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}
        <input
          className={cn(
            "w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all duration-200",
            "text-sm sm:text-base text-primary-900 placeholder:text-primary-400",
            "focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent-500",
            error ? "border-red-300 focus:border-red-500 focus:ring-red/20" : "border-accent/30",
            Icon && "pl-10 sm:pl-12",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs sm:text-sm text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}

export function ModernSelect({
  label,
  error,
  options,
  className,
  containerClassName,
  ...props
}) {
  return (
    <div className={cn("space-y-1 sm:space-y-2", containerClassName)}>
      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-primary-900">
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all duration-200",
          "text-sm sm:text-base text-primary-900",
          "focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent-500",
          "bg-white cursor-pointer",
          error ? "border-red-300 focus:border-red-500 focus:ring-red/20" : "border-accent/30",
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-xs sm:text-sm text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}

export function ModernTextarea({
  label,
  error,
  className,
  containerClassName,
  ...props
}) {
  return (
    <div className={cn("space-y-1 sm:space-y-2", containerClassName)}>
      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-primary-900">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          "w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all duration-200",
          "text-sm sm:text-base text-primary-900 placeholder:text-primary-400",
          "focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent-500",
          "resize-none",
          error ? "border-red-300 focus:border-red-500 focus:ring-red/20" : "border-accent/30",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs sm:text-sm text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
