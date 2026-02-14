import React, { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Calendar, Filter, X, ShoppingCart } from 'lucide-react';

const PurchaseFilters = React.memo(function PurchaseFilters({ _businessId, onApply, onClear }) {
  const [monthYear, setMonthYear] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApply = useCallback(() => {
    const filters = {};
    
    // Convertir mes/año a rango de fechas
    if (monthYear) {
      const [year, month] = monthYear.split('-');
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      filters.fromDate = firstDay.toISOString().split('T')[0];
      filters.toDate = lastDay.toISOString().split('T')[0];
    }

    setLoading(true);
    const result = onApply?.(filters);
    if (result?.finally) {
      result.finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [monthYear, onApply]);

  const handleClear = useCallback(() => {
    setMonthYear('');
    onClear?.();
  }, [onClear]);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl shadow-md border border-purple-100 p-4 sm:p-5 mb-6">
      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-800">Filtros de Compras</h3>
      </div>

      {/* Contenedor de filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        {/* Filtro Mes/Año */}
        <div className="lg:col-span-5 bg-white rounded-xl p-3 border border-gray-200 hover:border-purple-300 transition-all duration-200">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            Mes/Año
          </label>
          <Input 
            type="month" 
            value={monthYear} 
            onChange={e => setMonthYear(e.target.value)} 
            className="w-full border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg transition-all"
          />
        </div>

        {/* Botones de acción */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={handleApply}
            disabled={loading}
            className="h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {loading ? 'Aplicando...' : 'Aplicar Filtros'}
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
