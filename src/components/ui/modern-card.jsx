import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ModernCard({ 
  children, 
  className,
  hover = true,
  gradient = false,
  ...props 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-accent/10 transition-all duration-300",
        hover && "hover:shadow-xl hover:-translate-y-1",
        gradient && "bg-gradient-to-br from-white to-accent-50",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ModernCardHeader({ children, className, icon: Icon, ...props }) {
  return (
    <div className={cn("flex items-center justify-between mb-4 sm:mb-6", className)} {...props}>
      {Icon && (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl gradient-primary flex items-center justify-center mr-3">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ModernCardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn("text-lg sm:text-xl font-bold text-primary-900", className)} {...props}>
      {children}
    </h3>
  );
}

export function ModernCardContent({ children, className, ...props }) {
  return (
    <div className={cn("text-sm sm:text-base text-primary-700", className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, title, value, subtitle, trend, color = "primary" }) {
  const colorClasses = {
    primary: "from-primary-600 to-primary-900",
    accent: "from-accent-500 to-accent-700",
    secondary: "from-secondary-600 to-secondary-800",
    success: "from-green-500 to-green-700",
    warning: "from-yellow-500 to-yellow-700",
    danger: "from-red-500 to-red-700",
  };

  return (
    <ModernCard hover className="relative overflow-hidden">
      <div className={cn("absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br opacity-10 rounded-bl-full", colorClasses[color])} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className={cn("p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br", colorClasses[color])}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          {trend && (
            <span className={cn(
              "text-xs sm:text-sm font-semibold px-2 py-1 rounded-full",
              trend > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trend > 0 ? "+" : ""}{trend}%
            </span>
          )}
        </div>
        
        <div>
          <p className="text-xs sm:text-sm text-primary-600 font-medium mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-primary-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs sm:text-sm text-primary-500">{subtitle}</p>}
        </div>
      </div>
    </ModernCard>
  );
}
