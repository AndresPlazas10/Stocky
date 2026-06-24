import { Save, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { formatPrice } from '../../utils/formatters';

export function MesaOrderFooter({
  orderTotal,
  orderItemsCount,
  isOrderItemsSyncing,
  onSave,
  onPrintKitchen,
  onCloseOrder,
}) {
  return (
    <div className="border-t-2 border-accent-200 bg-accent-50/30 p-4 sm:p-6 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-primary-600 mb-1">Total a pagar</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-primary-900">
            {formatPrice(orderTotal)}
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={onSave}
            variant="outline"
            disabled={isOrderItemsSyncing}
            className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 px-6 w-full sm:w-auto"
          >
            <Save className="w-5 h-5 mr-2" />
            {isOrderItemsSyncing ? 'Sincronizando...' : 'Guardar'}
          </Button>
          <Button
            onClick={onPrintKitchen}
            variant="outline"
            className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 h-12 px-6 w-full sm:w-auto"
            disabled={orderItemsCount === 0}
          >
            <Printer className="w-5 h-5 mr-2" />
            Imprimir para cocina
          </Button>
          <Button
            onClick={onCloseOrder}
            disabled={orderItemsCount === 0}
            className="gradient-primary text-white hover:opacity-90 h-12 px-8 text-lg w-full sm:w-auto"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Cerrar Orden
          </Button>
        </div>
      </div>
    </div>
  );
}
