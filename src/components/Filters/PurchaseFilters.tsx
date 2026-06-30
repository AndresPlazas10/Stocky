import React, { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Calendar, Filter, X, ShoppingCart } from 'lucide-react';

type PurchaseFiltersProps = {
  _businessId?: string;
  onApply?: (filters: Record<string, unknown>) => void | Promise<unknown>;
  onClear?: () => void;
};

const PurchaseFilters = React.memo(function PurchaseFilters({
  _businessId,
  onApply,
  onClear,
}: PurchaseFiltersProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = useCallback(() => {
    const filters: Record<string, unknown> = {};

    if (selectedDate) {
      filters.fromDate = selectedDate;
      filters.toDate = selectedDate;
    }

    setLoading(true);
    const result = onApply?.(filters);
    if ((result as Promise<unknown>)?.finally) {
      (result as Promise<unknown>).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [selectedDate, onApply]);

  const handleClear = useCallback(() => {
    setSelectedDate('');
    onClear?.();
  }, [onClear]);

  return (
    <div className="bg-gradient-to-r from-gray-50 to-pink-50 rounded-2xl shadow-md border border-gray-100 p-4 sm:p-5 mb-6">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Filtros de Compras
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Filtra por un día específico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-6 bg-white rounded-xl p-3 border border-gray-200 hover:border-gray-300 transition-all duration-200">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            Día
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 rounded-lg transition-all"
          />
        </div>

        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={handleApply}
            disabled={loading}
            className="h-11 bg-gradient-to-r from-gray-600 to-pink-600 hover:from-gray-700 hover:to-pink-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {loading ? "Aplicando..." : "Aplicar Filtros"}
          </Button>
          <Button
            onClick={handleClear}
            className="h-11 bg-white hover:bg-gray-100 text-gray-700 font-medium rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpiar
          </Button>
        </div>
      </div>
    </div>
  );
});

export default PurchaseFilters;
