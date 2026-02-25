import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const _motionLintUsage = motion;

/**
 * Card optimizada para móvil
 * - Padding generoso para touch targets (16px min)
 * - Altura mínima de 44px para elementos clickeables
 * - Tipografía legible (14px min)
 * - Tap feedback visual
 */
export function MobileCard({ 
  children, 
  onClick, 
  className = "",
  interactive = false,
  showArrow = false 
}) {
  const cardContent = (
    <>
      <div className="flex-1">
        {children}
      </div>
      {showArrow && (
        <ChevronRight size={20} className="text-gray-400 shrink-0" />
      )}
    </>
  );

  if (onClick || interactive) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`
          w-full flex items-center gap-3
          bg-white rounded-xl p-4
          border border-gray-200
          shadow-sm
          active:shadow-md active:border-gray-300
          transition-all duration-150
          text-left
          ${className}
        `}
      >
        {cardContent}
      </motion.button>
    );
  }

  return (
    <div className={`
      bg-white rounded-xl p-4
      border border-gray-200
      shadow-sm
      ${className}
    `}>
      {children}
    </div>
  );
}

/**
 * Card de estadística para móvil
 * Diseño vertical compacto
 */
export function MobileStatCard({ icon: Icon, label, value, trend, color = "text-accent-600" }) {
  return (
    <MobileCard className="min-h-[100px]">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}
            </p>
          )}
        </div>
      </div>
    </MobileCard>
  );
}

/**
 * Card de lista para móvil
 * Optimizada para listas de productos, clientes, etc.
 */
export function MobileListCard({ 
  title, 
  subtitle, 
  meta, 
  icon: Icon,
  badge,
  onClick,
  actions
}) {
  return (
    <MobileCard 
      onClick={onClick} 
      interactive={!!onClick}
      showArrow={!!onClick}
    >
      <div className="flex items-center gap-3 min-h-[44px]">
        {Icon && (
          <div className="p-2 rounded-lg bg-gray-50 shrink-0">
            <Icon size={20} className="text-gray-600" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {badge && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-medium shrink-0
                ${badge.variant === 'success' && 'bg-green-100 text-green-700'}
                ${badge.variant === 'warning' && 'bg-yellow-100 text-yellow-700'}
                ${badge.variant === 'error' && 'bg-red-100 text-red-700'}
                ${badge.variant === 'info' && 'bg-blue-100 text-blue-700'}
              `}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-600 truncate">{subtitle}</p>
          )}
          {meta && (
            <p className="text-xs text-gray-500 mt-1">{meta}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-1 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </MobileCard>
  );
}
