import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getSalesSellersByBusiness } from '../../data/queries/authQueries.js';
import { Calendar, User, Filter, X, Receipt } from 'lucide-react';

const SalesFilters = React.memo(function SalesFilters({ businessId, onApply, onClear }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSellers() {
      if (!mounted) return;

      const allSellers = await getSalesSellersByBusiness(businessId);
      if (!mounted) return;
      setSellers(allSellers || []);
    }
    if (businessId) loadSellers();
    return () => { mounted = false; };
  }, [businessId]);

  const handleApply = useCallback(() => {
    const filters = {};

    if (selectedDate) {
      filters.fromDate = selectedDate;
      filters.toDate = selectedDate;
    }
    
    if (employeeId) filters.employeeId = employeeId;

    setLoading(true);
    const result = onApply?.(filters);
    if (result?.finally) {
      result.finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [selectedDate, employeeId, onApply]);

  const handleClear = useCallback(() => {
    setSelectedDate('');
    setEmployeeId('');
    onClear?.();
  }, [onClear]);

  // Memoizar opciones de vendedores
  const sellerOptions = useMemo(() => (
    sellers.map(seller => (
      <option key={seller.user_id} value={seller.user_id}>
        {seller.full_name}
      </option>
    ))
  ), [sellers]);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl shadow-md border border-purple-100 p-4 sm:p-5 mb-6">
      {/* Encabezado */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filtros de Ventas</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">Filtra por un día específico.</p>
      </div>

      {/* Contenedor de filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        {/* Filtro Día */}
        <div className="lg:col-span-4 bg-white rounded-xl p-3 border border-gray-200 hover:border-purple-300 transition-all duration-200">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            Día
          </label>
          <Input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg transition-all"
          />
        </div>
        
        {/* Filtro Vendedor */}
        <div className="lg:col-span-5 bg-white rounded-xl p-3 border border-gray-200 hover:border-purple-300 transition-all duration-200">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 text-purple-600" />
            Vendedor
          </label>
          <select 
            value={employeeId} 
            onChange={e => setEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all bg-white text-gray-900 outline-none"
          >
            <option value="">Todos los vendedores</option>
            {sellerOptions}
          </select>
        </div>

        {/* Botones de acción */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

export default SalesFilters;
