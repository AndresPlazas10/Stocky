import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { MesaCatalogSearch } from '../MesaCatalogSearch';
import { MesaOrderItemsGrid } from '../MesaOrderItemsGrid';
import { MesaOrderFooter } from '../MesaOrderFooter';
import { useTranslation } from 'react-i18next';
import type { OrderDetailsModalProps } from '@/types/components';

export function OrderDetailsModal({
  isOpen,
  selectedMesa,
  searchProduct,
  onSearchChange,
  filteredCatalog,
  visibleFilteredCatalog,
  hasMoreFilteredCatalog,
  totalFilteredCatalog,
  filteredCatalogSentinelRef,
  lowMotionMode,
  onAddItem,
  onLoadMoreFilteredCatalog,
  orderItems,
  visibleOrderItems,
  hasMoreOrderItems,
  totalOrderItems,
  orderItemsSentinelRef,
  getOrderItemRenderKey,
  getOrderItemName,
  onUpdateQuantity,
  onLoadMoreOrderItems,
  orderTotal,
  onSave,
  onPrintKitchen,
  onCloseOrder,
  onClose,
  orderNotes = '',
  onSaveNotes,
}: OrderDetailsModalProps) {
  const { t } = useTranslation(['mesas', 'common']);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    setNotesDraft(orderNotes || '');
    setNotesOpen(false);
  }, [orderNotes, isOpen]);

  const handleSaveOrderWithNotes = () => {
    if (notesOpen && onSaveNotes && notesDraft !== orderNotes) {
      onSaveNotes(notesDraft);
    }
    onSave();
  };

  return (
    <AnimatePresence>
      {isOpen && selectedMesa && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8"
          >
            <Card className="border-0 flex flex-col max-h-[85vh]">
              <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    {t('mesas:labels.tableNumber', { number: selectedMesa.table_number })} - {t('mesas:labels.orderDetails')}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-10 w-10 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 overflow-y-auto flex-1">
                <MesaCatalogSearch
                  searchProduct={searchProduct}
                  onSearchChange={onSearchChange}
                  filteredCatalog={filteredCatalog}
                  visibleFilteredCatalog={visibleFilteredCatalog}
                  hasMoreFilteredCatalog={hasMoreFilteredCatalog}
                  totalFilteredCatalog={totalFilteredCatalog}
                  filteredCatalogSentinelRef={filteredCatalogSentinelRef}
                  lowMotionMode={lowMotionMode}
                  onAddItem={onAddItem}
                  onLoadMore={onLoadMoreFilteredCatalog}
                />
                <MesaOrderItemsGrid
                  orderItems={orderItems}
                  visibleOrderItems={visibleOrderItems}
                  hasMoreOrderItems={hasMoreOrderItems}
                  totalOrderItems={totalOrderItems}
                  orderItemsSentinelRef={orderItemsSentinelRef}
                  lowMotionMode={lowMotionMode}
                  getOrderItemRenderKey={getOrderItemRenderKey}
                  getOrderItemName={getOrderItemName}
                  onUpdateQuantity={onUpdateQuantity}
                  onLoadMore={onLoadMoreOrderItems}
                />

                <div className="border-t border-accent-100 mt-4 pt-4">
                  {orderNotes && !notesOpen && (
                    <p className="text-sm italic text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                      💬 {orderNotes}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setNotesOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 transition-colors"
                  >
                    💬 {orderNotes ? t('mesas:buttons.editNote') : t('mesas:buttons.addNote')}
                  </button>

                  {notesOpen && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder={t('mesas:buttons.orderNotesPlaceholder')}
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 border-2 border-accent-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
              <MesaOrderFooter
                orderTotal={orderTotal}
                orderItemsCount={orderItems.length}
                onSave={handleSaveOrderWithNotes}
                onPrintKitchen={onPrintKitchen}
                onCloseOrder={onCloseOrder}
              />
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
