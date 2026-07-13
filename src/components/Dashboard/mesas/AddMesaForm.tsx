import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useTranslation } from 'react-i18next';
import type { AddMesaFormProps } from '@/types/components';

export function AddMesaForm({ showAddForm, canManageTables, isCreatingTable, newTableNumber, onNewTableNumberChange, onSubmit, onCancel }: AddMesaFormProps) {
  const { t } = useTranslation(['mesas', 'common']);
  return (
    <AnimatePresence>
      {showAddForm && canManageTables && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6"
        >
          <Card className="border-accent-200 bg-accent-50/30">
            <CardContent className="pt-6">
              <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-primary-700 mb-2">
                    {t('mesas:labels.tableNumber', { number: '' })}
                  </label>
                  <Input
                    type="text"
                    value={newTableNumber}
                    onChange={onNewTableNumberChange}
                    placeholder="Ej: 1, A1, Terraza-2..."
                    className="h-12 border-accent-300"
                    required
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button
                    type="submit"
                    disabled={isCreatingTable}
                    className="gradient-primary text-white h-12 w-full sm:w-auto disabled:opacity-50"
                  >
                    {isCreatingTable ? (
                      t('mesas:buttons.createTable')
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('mesas:buttons.createTable')}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 w-full sm:w-auto"
                    onClick={onCancel}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t('buttons.cancel', { ns: 'common' })}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
