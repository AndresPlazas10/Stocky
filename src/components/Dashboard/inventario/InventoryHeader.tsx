import { motion } from 'framer-motion';
import { Package, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import type { InventoryHeaderProps } from '@/types/components';

export function InventoryHeader({ hasAdminPrivileges, showForm, onToggleForm }: InventoryHeaderProps) {
  const { t } = useTranslation('common');
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="gradient-primary text-white shadow-xl rounded-2xl border-none mb-6">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('navigation.inventory')}</h1>
              <p className="text-white/80 mt-1 text-sm sm:text-base">
                {hasAdminPrivileges ? t('inventoryHeader.adminView') : t('inventoryHeader.employeeView')}
              </p>
            </div>
          </div>
          {hasAdminPrivileges && (
            <Button
              onClick={onToggleForm}
              className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-3 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center whitespace-nowrap"
            >
              {showForm ? (
                <>
                  <X className="w-5 h-5" />
                  {t('buttons.cancel')}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  {t('buttons.add')}
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
