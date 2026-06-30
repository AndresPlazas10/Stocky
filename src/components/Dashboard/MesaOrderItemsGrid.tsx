import { type RefObject } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { formatPrice, toFiniteNumber } from '../../utils/formatters';

interface OrderItem {
  id: string;
  combo_id?: string | null;
  price: string;
  subtotal: string;
  quantity: number;
}

interface MesaOrderItemsGridProps {
  orderItems: OrderItem[];
  visibleOrderItems: OrderItem[];
  hasMoreOrderItems: boolean;
  totalOrderItems: number;
  orderItemsSentinelRef: RefObject<HTMLDivElement | null>;
  lowMotionMode: boolean;
  isOrderItemsSyncing: boolean;
  getOrderItemRenderKey: (item: OrderItem, index: number) => string;
  getOrderItemName: (item: OrderItem) => string;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onLoadMore: () => void;
}

export function MesaOrderItemsGrid({
  orderItems,
  visibleOrderItems,
  hasMoreOrderItems,
  totalOrderItems,
  orderItemsSentinelRef,
  lowMotionMode,
  isOrderItemsSyncing,
  getOrderItemRenderKey,
  getOrderItemName,
  onUpdateQuantity,
  onLoadMore,
}: MesaOrderItemsGridProps) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-primary-900 mb-4">Items en la orden</h3>
      {orderItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="w-8 h-8 text-accent-600" />
          </div>
          <p className="text-accent-600">No hay items en esta orden</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleOrderItems.map((item, index) => (
              <motion.div
                key={getOrderItemRenderKey(item, index)}
                initial={lowMotionMode ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
              >
                <Card className="border-accent-200 hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-primary-900 text-sm sm:text-base leading-tight">
                            {getOrderItemName(item)}
                          </h4>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                            {item.combo_id && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                                Combo
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                              {formatPrice(parseFloat(item.price))} por unidad
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-primary-900">
                            {formatPrice(parseFloat(item.subtotal))}
                          </p>
                          <p className="text-[11px] text-accent-600">Subtotal</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-accent-100">
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-white p-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateQuantity(item.id, toFiniteNumber(item.quantity, 0) - 1)}
                            disabled={isOrderItemsSyncing}
                            className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            -
                          </Button>
                          <span className="w-10 text-center font-bold text-primary-900">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateQuantity(item.id, toFiniteNumber(item.quantity, 0) + 1)}
                            disabled={isOrderItemsSyncing}
                            className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          {hasMoreOrderItems && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <p className="text-xs text-accent-600">
                Mostrando {visibleOrderItems.length} de {totalOrderItems} items
              </p>
              <div ref={orderItemsSentinelRef} className="h-2 w-full" aria-hidden="true" />
              <Button
                type="button"
                onClick={onLoadMore}
                variant="outline"
                className="rounded-xl"
              >
                Cargar mas items
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
