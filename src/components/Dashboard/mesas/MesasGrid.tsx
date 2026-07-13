import { memo, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Layers, Trash2 } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';
import { useBusinessConfig } from '../../../hooks/useBusinessConfig';
import { useTranslation } from 'react-i18next';
import { getMesaProductUnits, getMesaInUseMessage } from './mesaHelpers';

interface MesaRecord {
  id: string;
  status: 'occupied' | 'available';
  table_number: number;
  orders?: { total?: string };
}

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
  getMesaLockState?: ((mesaId: string) => MesaLockState | null) | null;
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
  getMesaLockState = null
}: MesasGridProps) {
  const { t } = useTranslation(['mesas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  
  return (
    <>
      {/* Grid de mesas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleMesas.map((mesa, index) => {
          const shouldUseSelectedUnits = selectedMesaId && mesa.id === selectedMesaId && selectedMesaUnits !== null;
          const units = shouldUseSelectedUnits ? selectedMesaUnits : getMesaProductUnits(mesa);
          const lockState = typeof getMesaLockState === 'function' ? getMesaLockState(mesa.id) : null;
          const lockedByOther = Boolean(lockState?.lockedByOther);
          const isOccupied = mesa.status === 'occupied';

          return (
            <motion.div
              key={mesa.id}
              initial={lowMotionMode ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
            >
              <Card
                className={`relative transition-all duration-300 ${
                  lockedByOther ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-xl hover:-translate-y-1'
                } ${
                  lockedByOther
                    ? 'border-red-400 bg-red-50/40'
                    : (
                      isOccupied
                        ? 'border-yellow-400 bg-yellow-50/30'
                        : 'border-green-400 bg-green-50/30'
                    )
                }`}
                onClick={() => onOpenTable(mesa)}
              >
                <CardContent className="pt-6 text-center">
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

                  {/* Estado */}
                  <Badge
                    variant={lockedByOther ? 'destructive' : (isOccupied ? 'warning' : 'success')}
                    className="mb-3 text-sm font-semibold"
                  >
                    {lockedByOther ? '🔒 ' + t('mesas:labels.inUse') : (isOccupied ? '🔴 ' + t('mesas:labels.occupied') : '🟢 ' + t('mesas:labels.available'))}
                  </Badge>

                  {/* Información de la orden si está ocupada */}
                  {isOccupied && mesa.orders && !lockedByOther && (
                    <div className="mt-4 pt-4 border-t border-accent-200">
                      <p className="text-lg font-bold text-primary-900">
                        {fmtPrice(parseFloat(String(mesa.orders.total || '0')))}
                      </p>
                      <p className="text-sm text-primary-600">
                        {units} {t('mesas:labels.products')}
                      </p>
                    </div>
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

      {hasMoreMesas && (
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
