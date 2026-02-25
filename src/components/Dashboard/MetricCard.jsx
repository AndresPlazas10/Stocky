import React from 'react';
import { motion } from 'framer-motion';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const _motionLintUsage = motion;

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  delay = 0
}) {
  const variantStyles = {
    default: 'from-primary/10 to-primary/5 border-primary/20',
    success: 'from-green-500/10 to-green-500/5 border-green-500/20',
    warning: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
    danger: 'from-red-500/10 to-red-500/5 border-red-500/20',
    accent: 'from-accent/10 to-accent/5 border-accent/20',
  };

  const iconStyles = {
    default: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-500/10',
    warning: 'text-yellow-600 bg-yellow-500/10',
    danger: 'text-red-600 bg-red-500/10',
    accent: 'text-accent bg-accent/10',
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 bg-green-50';
    if (trend === 'down') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className={cn(
        "relative overflow-hidden border-2 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br",
        variantStyles[variant]
      )}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {title}
              </p>
              <motion.h3
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: delay + 0.1 }}
                className="text-3xl font-bold text-primary dark:text-white"
              >
                {value}
              </motion.h3>
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: delay + 0.2 
              }}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                iconStyles[variant]
              )}
            >
              {Icon && <Icon className="w-6 h-6" />}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>

            {/* Trend Badge */}
            {trendValue && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.3 }}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                <span>{trendValue}</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Animated border glow on hover */}
        <motion.div
          className="absolute inset-0 border-2 border-transparent rounded-2xl"
          whileHover={{
            borderColor: variant === 'default' ? '#ffe498' : undefined,
            boxShadow: '0 0 20px rgba(102, 165, 173, 0.3)',
          }}
          transition={{ duration: 0.3 }}
        />
      </Card>
    </motion.div>
  );
}

export function MetricsGrid({ children, columns = 4 }) {
  return (
    <div className={cn(
      "grid gap-6",
      columns === 4 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
      columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      columns === 2 && "grid-cols-1 md:grid-cols-2"
    )}>
      {children}
    </div>
  );
}
