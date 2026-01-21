import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  Truck,
  ShoppingBag,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Upload,
  Building2,
  Sparkles
} from 'lucide-react';
import ChangelogModal from '../ChangelogModal';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Inicio', section: 'home' },
  { icon: ShoppingCart, label: 'Ventas', section: 'ventas' },
  { icon: ShoppingBag, label: 'Compras', section: 'compras' },
  { icon: Package, label: 'Inventario', section: 'inventario' },
  { icon: Truck, label: 'Proveedores', section: 'proveedores' },
  { icon: Users, label: 'Empleados', section: 'empleados' },
  { icon: BarChart3, label: 'Reportes', section: 'reportes' },
  { icon: Settings, label: 'Configuración', section: 'configuracion' },
];

export const Sidebar = React.memo(function Sidebar({ activeSection, onSectionChange, businessName, businessLogo, onLogoChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const handleSectionClick = (section) => {
    onSectionChange(section);
    setIsMobileOpen(false);
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('El archivo es muy grande. Máximo 2MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoUrl = reader.result;
        
        if (onLogoChange) {
          onLogoChange(logoUrl);
        }
        
        setShowLogoUpload(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    if (onLogoChange) {
      onLogoChange(null);
    }
  };

  const SidebarContent = () => {
    return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-primary/10">
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          {/* Logo o icono - MÁS GRANDE */}
          <div className="relative group cursor-pointer">
            {businessLogo ? (
              <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white border-2 border-primary/20 shadow-lg">
                <img 
                  src={businessLogo} 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            )}
            
            {/* Overlay para cambiar logo */}
            <label className="absolute inset-0 bg-black/0 hover:bg-black/60 rounded-3xl flex items-center justify-center transition-all cursor-pointer group-hover:opacity-100 opacity-0">
              <Upload className="w-8 h-8 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 text-center w-full transition-opacity duration-150">
              <h1 className="text-xl font-bold text-primary">
                {businessName || 'Stocky'}
              </h1>
              <p className="text-xs text-muted-foreground">POS System</p>
              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer font-medium transition-colors hover:underline">
                  📷 Cambiar logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {businessLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors hover:underline"
                  >
                    ✕ Quitar logo
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.section;

          return (
            <button
              key={item.section}
              onClick={() => handleSectionClick(item.section)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 group relative overflow-hidden",
                isActive
                  ? "bg-primary text-white shadow-md"
                  : "text-gray-800 hover:bg-accent/10 hover:text-primary dark:text-gray-300"
              )}
            >
              {/* Hover effect background */}
              {!isActive && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              )}

              <Icon className={cn(
                "w-5 h-5 transition-transform duration-150 group-hover:scale-110",
                isActive ? "text-white" : "text-gray-700"
              )} />
              
              {!isCollapsed && (
                <span
                  className={cn(
                    "font-medium text-sm relative z-10 transition-opacity duration-150",
                    isActive ? "text-white" : "text-gray-800"
                  )}
                >
                  {item.label}
                </span>
              )}

              {isActive && (
                <motion.span
                  layoutId="activeIndicator"
                  className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* What's New button */}
      <div className={cn(
        "px-4 pb-2",
        isCollapsed && "px-2"
      )}>
        <button
          onClick={() => setShowChangelog(true)}
          className={cn(
            "w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-600 transition-all border border-amber-500/20",
            isCollapsed && "justify-center px-2"
          )}
        >
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-medium">Ver novedades</span>
          )}
        </button>
      </div>

      {/* Collapse button - Desktop only */}
      <div className="hidden lg:block p-4 border-t border-primary/10">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-accent/10 hover:bg-accent/20 text-primary transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Colapsar</span>
            </>
          )}
        </button>
      </div>
    </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-3 left-3 z-50 p-2.5 rounded-xl bg-white shadow-lg border border-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        className="hidden lg:flex flex-col h-screen bg-white border-r border-gray-200 sticky top-0 shadow-sm dark:bg-primary-900 dark:border-primary-700"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence mode="wait">
        {isMobileOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              onClick={toggleMobile}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
            />

            {/* Sidebar */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 dark:bg-primary-900"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Changelog Modal */}
      {showChangelog && (
        <ChangelogModal 
          forceOpen={true} 
          onClose={() => setShowChangelog(false)} 
        />
      )}
    </>
  );
});
