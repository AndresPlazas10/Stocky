import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { motion } from 'framer-motion';

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
  onSectionChange
}) {
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
