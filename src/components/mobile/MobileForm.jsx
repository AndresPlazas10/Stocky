
/**
 * Input optimizado para móvil
 * - Altura mínima 44px (touch-friendly)
 * - Padding generoso (12px)
 * - Tipografía legible (16px para evitar zoom en iOS)
 * - Borde visual claro
 */
export function MobileInput({ 
  label, 
  error, 
  helperText,
  icon: Icon,
  ...props 
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon size={20} />
          </div>
        )}
        
        <input
          {...props}
          className={`
            w-full h-12 px-4 ${Icon ? 'pl-11' : ''}
            text-base text-gray-900
            bg-white border rounded-lg
            transition-all duration-200
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
              : 'border-gray-300 focus:border-[#edb886] focus:ring-2 focus:ring-[#edb886]/20'
            }
            placeholder:text-gray-400
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          `}
          style={{ fontSize: '16px' }} // Evita zoom en iOS
        />
      </div>
      
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}

/**
 * Textarea optimizada para móvil
 */
export function MobileTextarea({ label, error, helperText, rows = 4, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        {...props}
        rows={rows}
        className={`
          w-full px-4 py-3
          text-base text-gray-900
          bg-white border rounded-lg
          transition-all duration-200
          resize-none
          ${error 
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
            : 'border-gray-300 focus:border-[#edb886] focus:ring-2 focus:ring-[#edb886]/20'
          }
          placeholder:text-gray-400
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        `}
        style={{ fontSize: '16px' }}
      />
      
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}

/**
 * Select optimizado para móvil
 */
export function MobileSelect({ label, error, helperText, options = [], ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <select
        {...props}
        className={`
          w-full h-12 px-4
          text-base text-gray-900
          bg-white border rounded-lg
          transition-all duration-200
          ${error 
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
            : 'border-gray-300 focus:border-[#edb886] focus:ring-2 focus:ring-[#edb886]/20'
          }
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        `}
        style={{ fontSize: '16px' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}

/**
 * Botón optimizado para móvil
 * - Altura mínima 44px
 * - Padding generoso
 * - Feedback táctil con animación
 */
export function MobileButton({ 
  children, 
  variant = "primary", 
  size = "md",
  fullWidth = false,
  icon: Icon,
  loading = false,
  ...props 
}) {
  const variants = {
    primary: "bg-accent-500 hover:bg-accent-700 text-white shadow-sm active:shadow-md",
    secondary: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 active:border-gray-400",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm active:shadow-md",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700 active:bg-gray-200",
  };

  const sizes = {
    sm: "h-10 px-4 text-sm",
    md: "h-12 px-6 text-base",
    lg: "h-14 px-8 text-lg",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      {...props}
      disabled={loading || props.disabled}
      className={`
        ${fullWidth ? 'w-full' : ''}
        ${sizes[size]}
        ${variants[variant]}
        rounded-lg font-semibold
        flex items-center justify-center gap-2
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${props.className || ''}
      `}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={20} />}
          {children}
        </>
      )}
    </motion.button>
  );
}
