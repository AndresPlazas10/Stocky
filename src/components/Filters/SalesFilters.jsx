import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../supabase/Client';
import { Calendar, User, Filter, X, Receipt } from 'lucide-react';

const SalesFilters = React.memo(function SalesFilters({ businessId, onApply, onClear }) {
  const [monthYear, setMonthYear] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSellers() {
      // Obtener usuario actual (administrador)
      const { data: { user } } = await supabase.auth.getUser();
      
      // Cargar empleados - solo campos necesarios
      const { data: employeesData } = await supabase
        .from('employees')
        .select('user_id, full_name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('full_name')
        .limit(100);
      
      if (!mounted) return;
      
      const allSellers = [...(employeesData || [])];
      
      // Agregar administrador al inicio de la lista si hay usuario autenticado
      // y no está ya en la lista de empleados
      if (user?.id) {
        const isAlreadyInList = allSellers.some(seller => seller.user_id === user.id);
        if (!isAlreadyInList) {
          allSellers.unshift({
            user_id: user.id,
            full_name: 'Administrador',
            is_admin: true
          });
        }
      }
      
      setSellers(allSellers);
    }
    if (businessId) loadSellers();
    return () => { mounted = false; };
  }, [businessId]);

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
    
    if (employeeId) filters.employeeId = employeeId;

    setLoading(true);
    const result = onApply?.(filters);
    if (result?.finally) {
      result.finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [monthYear, employeeId, onApply]);

  const handleClear = useCallback(() => {
    setMonthYear('');
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
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl shadow-md border border-purple-100 p-6 mb-6">
      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-800">Filtros de Ventas</h3>
      </div>

      {/* Contenedor de filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Filtro Mes/Año */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-purple-300 transition-all duration-200">
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
        
        {/* Filtro Vendedor */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-purple-300 transition-all duration-200">
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
      </div>
      
      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <Button 
          onClick={handleApply} 
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium px-6 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {loading ? 'Aplicando...' : 'Aplicar Filtros'}
        </Button>
        <Button 
          onClick={handleClear} 
          className="bg-white hover:bg-gray-100 text-gray-700 font-medium px-6 py-2 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Limpiar
        </Button>
      </div>
    </div>
  );
});

export default SalesFilters;
