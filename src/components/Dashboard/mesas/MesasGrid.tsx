import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Layers, Trash2, Bell } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import { useBusinessConfig } from '../../../hooks/useBusinessConfig';
import { useTranslation } from 'react-i18next';
import { setTableCallRequested } from '../../../data/commands/ordersCommands';
import { logger } from '@/utils/logger';
import type { MesaRecord } from '@/types/components';
import { getMesaProductUnits, getMesaInUseMessage, calculateOrderItemsTotal, CALL_WINDOW_MS } from './mesaHelpers';
import { resolveOrderRecencyMs } from '@stocky/shared';
import { ElapsedTimer } from './ElapsedTimer';

interface MesaLockState {
  lockedByOther?: boolean;
}

interface MesasGridProps {
  visibleMesas: MesaRecord[];
  totalMesas: number;
  hasMoreMesas: boolean;
  mesasSentinelRef: RefObject<HTMLDivElement | null>;
  loadMoreMesas: () => void;
  isEmployee: boolean;
  onOpenTable: (mesa: MesaRecord) => void;
  onDeleteTable: (mesaId: string) => void;
  selectedMesaId?: string | null;
  selectedMesaUnits?: number | null;
  lowMotionMode?: boolean;
  isKitchen?: boolean;
  businessId?: string;
  getMesaLockState?: ((mesaId: string) => MesaLockState | null) | null;
  mostRecentOrderId?: string | null;
  orderArrivalTsByOrderId?: React.MutableRefObject<Map<string, number>> | null;
  arrivalVersion?: number;
  onDismissCall?: (mesaId: string) => void;
  showInfo: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
}

const MesasGrid = memo(function MesasGrid({
  visibleMesas,
  totalMesas,
  hasMoreMesas,
  mesasSentinelRef,
  loadMoreMesas,
  isEmployee,
  onOpenTable,
  onDeleteTable,
  selectedMesaId = null,
  selectedMesaUnits = null,
  lowMotionMode = false,
  isKitchen = false,
  businessId,
  getMesaLockState = null,
  mostRecentOrderId = null,
  orderArrivalTsByOrderId = null,
  arrivalVersion = 0,
  onDismissCall,
  showInfo,
  showError,
}: MesasGridProps) {
  const { t } = useTranslation(['mesas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  const [callingMesaIds, setCallingMesaIds] = useState<Set<string>>(new Set());
  const callTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      callTimersRef.current.forEach((timer) => clearTimeout(timer));
      callTimersRef.current.clear();
    };
  }, []);

  const handleCallMesa = (mesaId: string) => {
    showInfo(t('mesas:toast.callSent.title'), t('mesas:toast.callSent.message'));
    setCallingMesaIds((prev) => new Set(prev).add(mesaId));
    const timer = setTimeout(() => {
      setCallingMesaIds((prev) => {
        const next = new Set(prev);
        next.delete(mesaId);
        return next;
      });
      callTimersRef.current.delete(mesaId);
    }, 4000);
    callTimersRef.current.set(mesaId, timer);

    if (businessId) {
      setTableCallRequested({ tableId: mesaId, businessId }).catch((err) => {
        showError('Error', t('mesas:errors.callSendFailed'));
        logger.warn('mesas:call_request_persist failed', err);
      });
    }
  };

  const handleDismissCall = (mesaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDismissCall?.(mesaId);
  };

  const isCallActive = (mesa: MesaRecord): boolean => {
    const raw = String(mesa?.call_requested_at || '').trim();
    if (!raw) return false;
    const calledAtMs = Date.parse(raw);
    if (!Number.isFinite(calledAtMs)) return false;
    return Date.now() - calledAtMs < CALL_WINDOW_MS;
  };

  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);

  const mesasToRender = isKitchen
    ? (() => {
        const occupied = (Array.isArray(visibleMesas) ? visibleMesas : []).filter((mesa) => mesa.status === 'occupied');
        return [...occupied].sort(
          (a, b) =>
            resolveOrderRecencyMs(b, orderArrivalTsByOrderId?.current) -
            resolveOrderRecencyMs(a, orderArrivalTsByOrderId?.current)
        );
      })()
    : visibleMesas;
  
  return (
    <>
      {/* Grid de mesas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mesasToRender.map((mesa, index) => {
          const shouldUseSelectedUnits = selectedMesaId && mesa.id === selectedMesaId && selectedMesaUnits !== null;
          const units = shouldUseSelectedUnits ? selectedMesaUnits : getMesaProductUnits(mesa);
          const lockState = typeof getMesaLockState === 'function' ? getMesaLockState(mesa.id) : null;
          const lockedByOther = Boolean(lockState?.lockedByOther);
          const isOccupied = mesa.status === 'occupied';
          const mesaOrderItems = Array.isArray(mesa.orders?.order_items) ? mesa.orders.order_items : [];
          const mesaOrderTotal = mesaOrderItems.length > 0
            ? calculateOrderItemsTotal(mesaOrderItems)
            : parseFloat(String(mesa.orders?.total || '0'));

          return (
            <motion.div
              key={mesa.id}
              data-testid="mesa-card"
              initial={lowMotionMode ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
            >
              <Card
                className={`relative transition-all duration-300 ${
                  callingMesaIds.has(mesa.id) ? 'ring-4 ring-amber-400 animate-pulse' : ''
                } ${
                  lockedByOther || isKitchen ? 'cursor-default' : 'cursor-pointer hover:shadow-xl hover:-translate-y-1'
                } ${
                  lockedByOther
                    ? 'border-red-400 bg-red-50/40'
                    : (
                      isOccupied
                        ? 'border-yellow-400 bg-yellow-50/30'
                        : 'border-green-400 bg-green-50/30'
                    )
                }`}
                onClick={isKitchen ? undefined : () => onOpenTable(mesa)}
              >
                <CardContent className="pt-6 text-center">
                  {/* Badge del pedido más reciente en cocina */}
                  {isKitchen && mostRecentOrderId && mesa.orders?.id === mostRecentOrderId && (
                    <div
                      data-testid="mesa-most-recent-badge"
                      className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 whitespace-nowrap rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {t('mesas:labels.mostRecentOrder')}
                    </div>
                  )}

                  {/* Campana de alerta de cocina (meseros) */}
                  {!isKitchen && isCallActive(mesa) && (
                    <motion.button
                      type="button"
                      onClick={(e) => handleDismissCall(mesa.id, e)}
                      title={t('mesas:labels.tableCall')}
                      aria-label={t('mesas:labels.tableCall')}
                      className="absolute top-2 left-2 z-10 h-10 w-10 rounded-full bg-amber-400 hover:bg-amber-500 text-white shadow-lg flex items-center justify-center"
                      animate={{ rotate: [-22, 22, -22] }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Bell className="w-5 h-5" />
                    </motion.button>
                  )}

                  {/* Botón eliminar (solo si está disponible y no es empleado) */}
                  {mesa.status === 'available' && !isEmployee && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTable(mesa.id);
                      }}
                      className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Icono de estado */}
                  <div className="mb-4 flex justify-center">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                      lockedByOther
                        ? 'bg-red-100 text-red-600'
                        : (
                          isOccupied
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-green-100 text-green-600'
                        )
                    }`}>
                      <Layers className="w-10 h-10" />
                    </div>
                  </div>

                  {/* Número de mesa */}
                  <h3 className="text-2xl font-bold text-primary-900 mb-2">
                    {t('mesas:labels.tableNumber', { number: mesa.table_number })}
                  </h3>

                  {/* Estado + temporizador de cocina */}
                  <div className="mb-3 flex items-center justify-center gap-2">
                    <Badge
                      variant={lockedByOther ? 'destructive' : (isOccupied ? 'warning' : 'success')}
                      className="text-sm font-semibold"
                    >
                      {lockedByOther ? '🔒 ' + t('mesas:labels.inUse') : (isOccupied ? '🔴 ' + t('mesas:labels.occupied') : '🟢 ' + t('mesas:labels.available'))}
                    </Badge>
                    {isKitchen && isOccupied && mesa.orders?.id ? (
                      <ElapsedTimer
                        startedAt={orderArrivalTsByOrderId?.current?.get(String(mesa.orders.id)) ?? 0}
                      />
                    ) : null}
                  </div>

                  {/* Información de la orden si está ocupada */}
                  {isOccupied && mesa.orders && !lockedByOther && (
                    isKitchen ? (
                      <div className="mt-4 pt-4 border-t border-accent-200 text-left">
                        {mesaOrderItems.length > 0 ? (
                          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {mesaOrderItems.map((item, idx) => (
                              <li
                                key={`${mesa.id}-item-${idx}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-sm font-semibold text-gray-800 truncate">
                                  {item.products?.name || item.combos?.nombre || t('mesas:defaults.item')}
                                </span>
                                <span className="shrink-0 inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-primary-100 text-primary-800 text-sm font-bold">
                                  x{item.quantity ?? 1}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">{t('mesas:labels.noItems')}</p>
                        )}

                        {mesa.orders?.notes ? (
                          <p className="mt-3 text-sm italic text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                            💬 {mesa.orders.notes}
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleCallMesa(mesa.id)}
                          disabled={callingMesaIds.has(mesa.id)}
                          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-md"
                        >
                          🔔 {isCallActive(mesa) ? t('mesas:buttons.callAgain') : t('mesas:buttons.call')}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-accent-200">
                        <p className="text-lg font-bold text-primary-900">
                          {fmtPrice(mesaOrderTotal)}
                        </p>
                      </div>
                    )
                  )}

                  {lockedByOther ? (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/85 backdrop-blur-sm">
                      <div className="max-w-[85%] rounded-lg border border-red-200 bg-red-100/90 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm">
                        {getMesaInUseMessage(t)}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {hasMoreMesas && !isKitchen && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-xs text-gray-500">
            {t('mesas:labels.showing')} {visibleMesas.length} {t('mesas:labels.of')} {totalMesas} {t('mesas:labels.tables')}
          </p>
          <div ref={mesasSentinelRef} className="h-2 w-full" aria-hidden="true" />
          <Button
            onClick={loadMoreMesas}
            variant="outline"
            className="rounded-xl"
          >
            {t('mesas:buttons.loadMore')}
          </Button>
        </div>
      )}

    </>
  );
});

export default MesasGrid;
