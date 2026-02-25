import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

import { MobileHeader, MobileDrawer } from '../mobile';
import { useViewport } from '../../hooks/useViewport';

const _motionLintUsage = motion;

export function DashboardLayout({ 
  children, 
  userName, 
  userEmail, 
  userRole,
  businessName,
  businessId,
  businessLogo,
  onLogoChange,
  onSignOut,
  activeSection,
  onSectionChange,
  warmupStatus
}) {
  const { isMobile } = useViewport();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // En móvil, usamos navegación inferior
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
        {/* Header móvil */}
        <MobileHeader
          businessName={businessName}
          onMenuClick={() => setDrawerOpen(true)}
          showSearch={false}
          showNotifications={false}
          warmupStatus={warmupStatus}
        />

        {/* Drawer lateral */}
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          currentView={activeSection}
          onNavigate={onSectionChange}
          userName={userName}
          businessName={businessName}
          onSignOut={onSignOut}
        />

        {/* Contenido principal con padding solo para header */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto pt-14 px-4 pb-6"
        >
          {children}
        </motion.main>

        {/* Changelog Modal removed */}
      </div>
    );
  }

  // Desktop: Layout original
  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-primary-900">
      {/* Sidebar */}
      <Sidebar 
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        businessName={businessName}
        businessLogo={businessLogo}
        onLogoChange={onLogoChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar 
          userName={userName} 
          userEmail={userEmail} 
          userRole={userRole}
          businessId={businessId}
          onSignOut={onSignOut}
          warmupStatus={warmupStatus}
        />

        {/* Page Content */}
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto p-6 lg:p-8"
        >
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
}
