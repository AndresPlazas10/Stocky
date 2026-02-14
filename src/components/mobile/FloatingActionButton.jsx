import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Floating Action Button (FAB) para móvil
 * - Botón flotante en esquina inferior derecha
 * - Acción principal contextual (añadir venta, producto, etc.)
 * - Animación de entrada/salida
 * - Thumb-friendly (56x56px)
 */
export function FloatingActionButton({ 
  onClick, 
  icon: Icon = Plus, 
  label = "Añadir",
  show = true,
  variant = "primary" // primary | secondary | accent
}) {
  const variants = {
    primary: "bg-accent-500 hover:bg-accent-700 text-white shadow-accent-500/30",
    secondary: "bg-secondary-500 hover:bg-secondary-600 text-white shadow-secondary-500/30",
    accent: "bg-soft-500 hover:bg-soft-600 text-white shadow-soft-500/30",
  };

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: show ? 1 : 0, 
        opacity: show ? 1 : 0 
      }}
      transition={{ 
        type: "spring", 
        stiffness: 500, 
        damping: 30 
      }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        fixed bottom-20 right-4 z-40
        w-14 h-14 rounded-full
        flex items-center justify-center
        shadow-lg hover:shadow-xl
        transition-all duration-200
        sm:hidden
        ${variants[variant]}
      `}
      aria-label={label}
    >
      <Icon size={24} strokeWidth={2.5} />
    </motion.button>
  );
}
