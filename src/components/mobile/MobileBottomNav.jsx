import { Home, ShoppingCart, Package, FileText, Users, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Bottom Navigation para móvil
 * Sigue las guías de Material Design para navegación inferior
 * - Botones entre 44-56px de altura (thumb-friendly)
 * - Máximo 5 items principales
 * - Indicador visual de sección activa
 */
export function MobileBottomNav({ currentView, onNavigate }) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'ventas', icon: ShoppingCart, label: 'Ventas' },
    { id: 'inventario', icon: Package, label: 'Productos' },
    { id: 'facturas', icon: FileText, label: 'Facturas' },
    { id: 'mas', icon: Settings, label: 'Más' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe sm:hidden">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                relative flex flex-col items-center justify-center gap-0.5
                transition-colors duration-200
                ${isActive ? 'text-accent-600' : 'text-gray-500'}
                active:bg-gray-50
              `}
            >
              {/* Indicador visual superior para item activo */}
              {isActive && (
                <motion.span
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-accent-500 rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              
              <Icon 
                size={20} 
                strokeWidth={isActive ? 2.5 : 2}
                className="shrink-0"
              />
              <span className={`
                text-[10px] font-medium leading-tight
                ${isActive ? 'font-semibold' : 'font-normal'}
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
