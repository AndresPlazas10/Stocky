import { X, Home, ShoppingCart, ShoppingBag, Package, FileText, Users, Truck, BarChart3, Settings, LogOut, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Drawer lateral swipeable para móvil
 * - Se desliza desde la izquierda
 * - Overlay semi-transparente
 * - Gestos de swipe para cerrar
 * - Navegación completa del dashboard
 */
export function MobileDrawer({ isOpen, onClose, currentView, onNavigate, userName, businessName, onSignOut }) {
  const menuSections = [
    {
      title: 'Principal',
      items: [
        { id: 'home', icon: Home, label: 'Inicio', color: 'text-blue-600' },
        { id: 'ventas', icon: ShoppingCart, label: 'Ventas', color: 'text-green-600' },
        { id: 'compras', icon: ShoppingBag, label: 'Compras', color: 'text-amber-600' },
        { id: 'inventario', icon: Package, label: 'Inventario', color: 'text-purple-600' },
      ]
    },
    {
      title: 'Gestión',
      items: [
        { id: 'proveedores', icon: Truck, label: 'Proveedores', color: 'text-indigo-600' },
        { id: 'empleados', icon: Users, label: 'Empleados', color: 'text-cyan-600' },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { id: 'reportes', icon: BarChart3, label: 'Reportes', color: 'text-teal-600' },
        { id: 'configuracion', icon: Settings, label: 'Configuración', color: 'text-gray-600' },
      ]
    }
  ];

  const handleItemClick = (itemId) => {
    onNavigate(itemId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 sm:hidden"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            drag="x"
            dragConstraints={{ left: -280, right: 0 }}
            dragElastic={{ left: 0, right: 0.2 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x < -50 || velocity.x < -500) {
                onClose();
              }
            }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl flex flex-col sm:hidden"
          >
            {/* Header del drawer */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 gradient-primary">
              <div className="flex-1">
                <h2 className="text-white font-bold text-lg">{businessName || 'Stockly'}</h2>
                <p className="text-white/80 text-sm">{userName || 'Usuario'}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Cerrar menú"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto py-2">
              {menuSections.map((section) => (
                <div key={section.title} className="mb-6">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-1 px-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-3 rounded-lg
                            transition-all duration-200
                            ${isActive 
                              ? 'bg-accent-500/10 text-accent-600 font-semibold' 
                              : 'text-gray-700 hover:bg-gray-100'
                            }
                          `}
                        >
                          <Icon 
                            size={20} 
                            className={isActive ? item.color : 'text-gray-500'}
                            strokeWidth={isActive ? 2.5 : 2}
                          />
                          <span className="flex-1 text-left text-sm">{item.label}</span>
                          {isActive && (
                            <ChevronRight size={16} className="text-accent-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer con logout */}
            <div className="border-t border-gray-200 p-4">
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={20} />
                <span className="text-sm font-medium">Cerrar sesión</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
