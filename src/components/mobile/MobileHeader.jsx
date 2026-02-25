import { Menu, Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { WarmupStatusBadge } from '../WarmupStatusBadge.jsx';

const _motionLintUsage = motion;

/**
 * Header optimizado para móvil
 * - Altura compacta (56px)
 * - Logo centrado o a la izquierda
 * - Acciones rápidas a la derecha
 * - Hamburger menu a la izquierda
 */
export function MobileHeader({ 
  onMenuClick, 
  businessName = "Stocky",
  showSearch = false,
  showNotifications = false,
  onSearchClick,
  onNotificationClick,
  warmupStatus = null
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 sm:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Botón de menú */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg active:bg-gray-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={24} className="text-gray-700" />
        </motion.button>

        {/* Logo/Nombre del negocio */}
        <div className="flex-1 min-w-0 px-2 flex items-center justify-center gap-2">
          <h1 className="text-lg font-bold text-accent-600 truncate max-w-[160px]">
            {businessName}
          </h1>
          <WarmupStatusBadge status={warmupStatus} className="px-2 py-0.5" />
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-1">
          {showSearch && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSearchClick}
              className="p-2 rounded-lg active:bg-gray-100 transition-colors"
              aria-label="Buscar"
            >
              <Search size={20} className="text-gray-600" />
            </motion.button>
          )}
          
          {showNotifications && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onNotificationClick}
              className="p-2 rounded-lg active:bg-gray-100 transition-colors relative"
              aria-label="Notificaciones"
            >
              <Bell size={20} className="text-gray-600" />
              {/* Badge opcional para notificaciones pendientes */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
}
