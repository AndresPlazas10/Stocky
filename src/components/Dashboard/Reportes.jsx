import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  Building2,
  FileText,
  Award,
  CreditCard,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';

function Reportes({ businessId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  
  const [metrics, setMetrics] = useState({
    totalVentas: 0,
    cantidadVentas: 0,
    totalCompras: 0,
    cantidadCompras: 0,
    productosStock: 0,
    productosLowStock: 0,
    totalProveedores: 0,
    totalFacturas: 0,
    gananciaBruta: 0
  });

  const [topProductos, setTopProductos] = useState([]);
  const [ventasPorMetodo, setVentasPorMetodo] = useState([]);

  useEffect(() => {
    if (businessId) {
      loadReportes();
    }
  }, [businessId, selectedPeriod]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate = new Date();

    switch (selectedPeriod) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    return {
      start: startDate.toISOString(),
      end: now.toISOString()
    };
  }, [selectedPeriod]);

  const loadReportes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { start, end } = getDateRange();

      const { data: ventas, error: ventasError } = await supabase
        .from('sales')
        .select('total, payment_method')
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);

      if (ventasError) throw ventasError;

      const totalVentas = ventas?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;
      const cantidadVentas = ventas?.length || 0;

      const paymentMethods = {};
      ventas?.forEach(v => {
        const method = v.payment_method || 'Otro';
        paymentMethods[method] = (paymentMethods[method] || 0) + v.total;
      });
      setVentasPorMetodo(
        Object.entries(paymentMethods).map(([method, total]) => ({ method, total }))
      );

      const { data: compras, error: comprasError } = await supabase
        .from('purchases')
        .select('total')
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);

      if (comprasError) throw comprasError;

      const totalCompras = compras?.reduce((sum, c) => sum + (c.total || 0), 0) || 0;
      const cantidadCompras = compras?.length || 0;

      const { data: productos, error: productosError } = await supabase
        .from('products')
        .select('stock, min_stock, is_active')
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (productosError) throw productosError;

      const productosStock = productos?.length || 0;
      const productosLowStock = productos?.filter(p => p.stock <= p.min_stock).length || 0;

      const { count: totalProveedores, error: proveedoresError } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);

      if (proveedoresError) throw proveedoresError;

      const { count: totalFacturas, error: facturasError } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', start)
        .lte('created_at', end);

      if (facturasError) throw facturasError;

      // 6. Top productos más vendidos y cálculo de ganancia real
      const { data: saleDetails, error: saleDetailsError } = await supabase
        .from('sale_details')
        .select(`
          quantity,
          unit_price,
          sale_id,
          products!inner(name, purchase_price),
          sales!inner(business_id, created_at)
        `)
        .eq('sales.business_id', businessId)
        .gte('sales.created_at', start)
        .lte('sales.created_at', end);

      if (saleDetailsError) throw saleDetailsError;

      const productMap = {};
      let costoProductosVendidos = 0;

      saleDetails?.forEach(item => {
        const productName = item.products?.name || 'Producto sin nombre';
        const purchasePrice = item.products?.purchase_price || 0;
        const quantity = item.quantity || 0;

        // Acumular para top productos
        if (productMap[productName]) {
          productMap[productName] += quantity;
        } else {
          productMap[productName] = quantity;
        }

        // Calcular costo real de productos vendidos
        costoProductosVendidos += purchasePrice * quantity;
      });

      const topProducts = Object.entries(productMap)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setTopProductos(topProducts);

      // Ganancia bruta = Ventas - Costo de productos vendidos
      const gananciaBruta = totalVentas - costoProductosVendidos;

      setMetrics({
        totalVentas,
        cantidadVentas,
        totalCompras,
        cantidadCompras,
        productosStock,
        productosLowStock,
        totalProveedores: totalProveedores || 0,
        totalFacturas: totalFacturas || 0,
        gananciaBruta
      });

    } catch (error) {
      setError('❌ Error al cargar los reportes');
    } finally {
      setLoading(false);
    }
  }, [businessId, getDateRange]);

  useEffect(() => {
    if (businessId) {
      loadReportes();
    }
  }, [businessId, selectedPeriod, loadReportes]);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'Hoy';
      case 'week': return 'Última Semana';
      case 'month': return 'Último Mes';
      default: return 'Último Mes';
    }
  };

  const getPaymentMethodIcon = (method) => {
    const methodLower = method?.toLowerCase() || '';
    if (methodLower.includes('cash') || methodLower.includes('efectivo')) {
      return <DollarSign className="w-6 h-6" />;
    }
    if (methodLower.includes('card') || methodLower.includes('tarjeta')) {
      return <CreditCard className="w-6 h-6" />;
    }
    return <CreditCard className="w-6 h-6" />;
  };

  const getPaymentMethodColor = (method) => {
    const methodLower = method?.toLowerCase() || '';
    if (methodLower.includes('cash') || methodLower.includes('efectivo')) {
      return 'from-green-500 to-green-600';
    }
    if (methodLower.includes('card') || methodLower.includes('tarjeta')) {
      return 'from-blue-500 to-blue-600';
    }
    return 'from-gray-500 to-gray-600';
  };

  const getPaymentMethodLabel = (method) => {
    const methodLower = method?.toLowerCase() || '';
    if (methodLower.includes('cash') || methodLower.includes('efectivo')) return 'Efectivo';
    if (methodLower.includes('card') || methodLower.includes('tarjeta')) return 'Tarjeta';
    if (methodLower.includes('transfer') || methodLower.includes('transferencia')) return 'Transferencia';
    if (methodLower.includes('mixed') || methodLower.includes('mixto')) return 'Mixto';
    return method || 'Otro';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#ffe498]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-accent-500 to-secondary-500 rounded-xl">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Reportes y Estadísticas</h1>
                <p className="text-gray-600">Análisis del desempeño de tu negocio</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all bg-white font-medium"
              >
                <option value="today">Hoy</option>
                <option value="week">Última Semana</option>
                <option value="month">Último Mes</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Alertas */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AsyncStateWrapper
          loading={loading}
          error={error}
          dataCount={loading ? 0 : 1}
          onRetry={loadReportes}
          skeletonType="reportes"
        >
          <div className="space-y-6 sm:space-y-8">
            {/* Métricas Principales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6"
            >
              {/* Ventas Totales */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                    Ventas
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">Total Ventas</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{formatPrice(metrics.totalVentas)}</p>
                  <p className="text-xs sm:text-sm opacity-80">{metrics.cantidadVentas} transacciones</p>
                </div>
              </motion.div>

              {/* Compras Totales */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                    Compras
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">Total Compras</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{formatPrice(metrics.totalCompras)}</p>
                  <p className="text-xs sm:text-sm opacity-80">{metrics.cantidadCompras} compras</p>
                </div>
              </motion.div>

              {/* Ganancia Bruta */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className={`bg-gradient-to-br ${
                  metrics.gananciaBruta >= 0 
                    ? 'from-purple-500 to-purple-600' 
                    : 'from-red-500 to-red-600'
                } rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all`}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    {metrics.gananciaBruta >= 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {metrics.gananciaBruta >= 0 ? 'Ganancia' : 'Pérdida'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">Ganancia Bruta</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{formatPrice(metrics.gananciaBruta)}</p>
                  <p className="text-xs sm:text-sm opacity-80">
                    {metrics.gananciaBruta >= 0 ? 'Positivo ✓' : 'Negativo ⚠'}
                  </p>
                </div>
              </motion.div>

              {/* Facturas */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    {getPeriodLabel()}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">Facturas Generadas</p>
                  <p className="text-2xl sm:text-3xl font-bold">{metrics.totalFacturas}</p>
                  <p className="text-xs sm:text-sm opacity-80">En este período</p>
                </div>
              </motion.div>
            </motion.div>

            {/* Métricas Secundarias */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6"
            >
              {/* Productos Activos */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-accent-500/10 to-[#ffe498]/10 rounded-xl">
                    <Package className="w-8 h-8 text-accent-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-800">{metrics.productosStock}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">Productos Activos</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-500 to-[#ffe498]" style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Stock Bajo */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    metrics.productosLowStock > 0 
                      ? 'bg-red-100' 
                      : 'bg-green-100'
                  }`}>
                    <AlertTriangle className={`w-8 h-8 ${
                      metrics.productosLowStock > 0 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`} />
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      metrics.productosLowStock > 0 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>{metrics.productosLowStock}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">Stock Bajo</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      metrics.productosLowStock > 0 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-green-500 to-green-600'
                    }`} 
                    style={{ width: metrics.productosStock > 0 ? `${(metrics.productosLowStock / metrics.productosStock) * 100}%` : '0%' }}
                  ></div>
                </div>
              </div>

              {/* Proveedores */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl">
                    <Building2 className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-800">{metrics.totalProveedores}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">Proveedores Activos</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: '100%' }}></div>
                </div>
              </div>
            </motion.div>

            {/* Top Productos y Métodos de Pago */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6"
            >
              {/* Top 5 Productos */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="gradient-primary text-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Top 5 Productos</h3>
                      <p className="text-white/80">Más vendidos del período</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {topProductos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <PieChart className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topProductos.map((producto, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' :
                              index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' :
                              'bg-gradient-to-br from-gray-300 to-gray-400'
                            }`}>
                              {index + 1}
                            </div>
                            <span className="font-semibold text-gray-800">{producto.name}</span>
                          </div>
                          <span className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-bold text-sm">
                            {producto.quantity} vendidos
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Métodos de Pago */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="gradient-primary text-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Métodos de Pago</h3>
                      <p className="text-white/80">Desglose de ventas</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {ventasPorMetodo.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <CreditCard className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ventasPorMetodo.map((metodo, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 bg-gradient-to-br ${getPaymentMethodColor(metodo.method)} rounded-lg text-white`}>
                              {getPaymentMethodIcon(metodo.method)}
                            </div>
                            <span className="font-semibold text-gray-800">{getPaymentMethodLabel(metodo.method)}</span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            {formatPrice(metodo.total)}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </AsyncStateWrapper>
      </div>
    </div>
  );
}

export default Reportes;
