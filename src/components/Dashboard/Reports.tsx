import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { getReportsSnapshot } from '../../data/queries/reportsQueries';
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
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';
import { isBankPaymentMethod } from '../../utils/paymentMethodBranding';
import { PaymentMethodBankLogo, getPaymentMethodLabel } from '../ui/PaymentMethodBankLogo';
import type { DashboardModuleProps } from '@/types/components';

function Reports({ businessId }: DashboardModuleProps) {
  const { t } = useTranslation(['reports', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    salesCount: 0,
    totalPurchases: 0,
    purchasesCount: 0,
    productsInStock: 0,
    lowStockProducts: 0,
    totalSuppliers: 0,
    totalInvoices: 0,
    grossProfit: 0
  });

  const [topProducts, setTopProducts] = useState<Array<{ name: string; quantity: number }>>([]);
  const [salesByMethod, setSalesByMethod] = useState<Array<{ method: string; total: number }>>([]);

  const normalizePaymentMethodKey = useCallback((method: string): string => {
    const methodLower = String(method || '').trim().toLowerCase();
    if (!methodLower) return 'other';

    if (methodLower === 'cash' || methodLower.includes('efectivo')) return 'cash';
    if (methodLower === 'card' || methodLower.includes('tarjeta')) return 'card';
    if (methodLower === 'transfer' || methodLower.includes('transferencia')) return 'transfer';
    if (methodLower === 'mixed' || methodLower.includes('mixto')) return 'mixed';
    if (methodLower.includes('nequi')) return 'nequi';
    if (methodLower.includes('bancolombia')) return 'bancolombia';
    if (methodLower.includes('banco_bogota') || methodLower.includes('banco de bogotá') || methodLower.includes('banco de bogota') || methodLower.includes('bogota')) return 'banco_bogota';
    if (methodLower === 'nu' || methodLower.includes('nu')) return 'nu';
    if (methodLower.includes('davivienda')) return 'davivienda';
    return methodLower;
  }, []);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const startDate = new Date();

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

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { start, end } = getDateRange();

      const {
        sales,
        purchases,
        products,
        totalSuppliers,
        totalInvoices,
        saleDetails,
        comboSaleDetails,
        combos,
        purchaseProducts
      } = await getReportsSnapshot({
        businessId,
        start,
        end
      });

      const totalSales = sales?.reduce((sum: number, v: Record<string, unknown>) => sum + ((v.total as number) || 0), 0) || 0;
      const salesCount = sales?.length || 0;
      const totalPurchases = purchases?.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.total as number) || 0), 0) || 0;
      const purchasesCount = purchases?.length || 0;
      const productsInStock = products?.length || 0;
      const lowStockProducts = products?.filter((p: Record<string, unknown>) => p.manage_stock !== false && (p.stock as number) <= (p.min_stock as number)).length || 0;

      const paymentMethods: Record<string, number> = {};
      sales?.forEach((v: Record<string, unknown>) => {
        const method = normalizePaymentMethodKey((v.payment_method as string) || 'other');
        paymentMethods[method] = (paymentMethods[method] || 0) + (v.total as number);
      });
      setSalesByMethod(
        Object.entries(paymentMethods).map(([method, total]) => ({ method, total }))
      );

      const productMap: Record<string, number> = {};
      let cogs = 0;

      const purchasePriceByProductId = new Map<string, number>();
      (purchaseProducts || []).forEach((product: Record<string, unknown>) => {
        const productId = String(product?.id || '').trim();
        if (!productId) return;
        const price = Number(product?.purchase_price || 0);
        purchasePriceByProductId.set(productId, Number.isFinite(price) ? price : 0);
      });

      const comboCostByComboId = new Map<string, number>();
      (combos || []).forEach((combo: Record<string, unknown>) => {
        const comboId = String(combo?.id || '').trim();
        if (!comboId) return;

        const comboUnitCost = ((combo?.combo_items as Array<Record<string, unknown>>) || []).reduce((sum: number, component: Record<string, unknown>) => {
          const componentProductId = String(component?.producto_id || component?.product_id || '').trim();
          if (!componentProductId) return sum;

          const componentQty = Number(component?.cantidad ?? component?.quantity ?? 0);
          if (!Number.isFinite(componentQty) || componentQty <= 0) return sum;

          const embeddedPurchasePrice = Number((component?.products as Record<string, unknown>)?.purchase_price);
          const mappedPurchasePrice = Number(purchasePriceByProductId.get(componentProductId) || 0);
          const purchasePrice = Number.isFinite(embeddedPurchasePrice) && embeddedPurchasePrice > 0
            ? embeddedPurchasePrice
            : mappedPurchasePrice;

          return sum + (purchasePrice * componentQty);
        }, 0);

        comboCostByComboId.set(comboId, comboUnitCost);
      });

      saleDetails?.forEach((item: Record<string, unknown>) => {
        const productName = ((item?.products as Record<string, unknown>)?.name as string) || t('labels.product');
        const purchasePrice = ((item?.products as Record<string, unknown>)?.purchase_price as number) || 0;
        const quantity = (item.quantity as number) || 0;

        if (productMap[productName]) {
          productMap[productName] += quantity;
        } else {
          productMap[productName] = quantity;
        }

        cogs += purchasePrice * quantity;
      });

      comboSaleDetails?.forEach((item: Record<string, unknown>) => {
        const comboId = String(item?.combo_id || '').trim();
        if (!comboId) return;

        const soldQty = Number(item?.quantity || 0);
        if (!Number.isFinite(soldQty) || soldQty <= 0) return;

        const comboFromDetail = item?.combos as Record<string, unknown> | null;
        const comboUnitCostFromDetail = (((comboFromDetail?.combo_items as Array<Record<string, unknown>>) || []).reduce((sum: number, component: Record<string, unknown>) => {
          const componentProductId = String(component?.producto_id || component?.product_id || '').trim();
          if (!componentProductId) return sum;

          const componentQty = Number(component?.cantidad ?? component?.quantity ?? 0);
          if (!Number.isFinite(componentQty) || componentQty <= 0) return sum;

          const embeddedPurchasePrice = Number((component?.products as Record<string, unknown>)?.purchase_price);
          const mappedPurchasePrice = Number(purchasePriceByProductId.get(componentProductId) || 0);
          const purchasePrice = Number.isFinite(embeddedPurchasePrice) && embeddedPurchasePrice > 0
            ? embeddedPurchasePrice
            : mappedPurchasePrice;

          return sum + (purchasePrice * componentQty);
        }, 0));

        const comboUnitCost = comboUnitCostFromDetail > 0
          ? comboUnitCostFromDetail
          : Number(comboCostByComboId.get(comboId) || 0);
        cogs += (comboUnitCost * soldQty);
      });

      const topProducts = Object.entries(productMap)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setTopProducts(topProducts);

      const grossProfit = Number(totalSales) - Number(cogs);

      setMetrics({
        totalSales: Number(totalSales),
        salesCount: Number(salesCount),
        totalPurchases: Number(totalPurchases),
        purchasesCount,
        productsInStock,
        lowStockProducts,
        totalSuppliers: totalSuppliers || 0,
        totalInvoices: totalInvoices || 0,
        grossProfit
      });

      saveOfflineSnapshot(`reportes.snapshot:${businessId}:${selectedPeriod}`, {
        metrics: {
          totalSales,
          salesCount,
          totalPurchases,
          purchasesCount,
          productsInStock,
          lowStockProducts,
          totalSuppliers: totalSuppliers || 0,
          totalInvoices: totalInvoices || 0,
          grossProfit
        },
        topProducts: topProducts,
        salesByMethod: Object.entries(paymentMethods).map(([method, total]) => ({ method, total }))
      });

    } catch {
      if (isOfflineMode()) {
        const cached = readOfflineSnapshot(`reportes.snapshot:${businessId}:${selectedPeriod}`, null) as Record<string, unknown> | null;
        if (cached?.metrics) setMetrics(cached.metrics as typeof metrics);
        if (Array.isArray(cached?.topProducts)) setTopProducts(cached.topProducts as Array<{ name: string; quantity: number }>);
        if (Array.isArray(cached?.salesByMethod)) setSalesByMethod(cached.salesByMethod as Array<{ method: string; total: number }>);
      } else {
        setError('❌ ' + t('reports:errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, getDateRange, normalizePaymentMethodKey, selectedPeriod, t]);

  useEffect(() => {
    if (businessId) {
      loadReports();
    }
  }, [businessId, selectedPeriod, loadReports]);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return t('reports:labels.today');
      case 'week': return t('reports:labels.week');
      case 'month': return t('reports:labels.month');
      default: return t('reports:labels.month');
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    const methodKey = normalizePaymentMethodKey(method);
    if (methodKey === 'cash') {
      return <DollarSign className="w-6 h-6" />;
    }
    if (methodKey === 'card') {
      return <CreditCard className="w-6 h-6" />;
    }
    if (['transfer', 'nequi', 'bancolombia', 'banco_bogota', 'nu', 'davivienda'].includes(methodKey)) {
      return <Building2 className="w-6 h-6" />;
    }
    return <CreditCard className="w-6 h-6" />;
  };

  const getPaymentMethodColor = (method: string) => {
    const methodKey = normalizePaymentMethodKey(method);
    if (methodKey === 'cash') {
      return 'from-green-500 to-green-600';
    }
    if (methodKey === 'card') {
      return 'from-gray-500 to-gray-600';
    }
    if (methodKey === 'transfer') return 'from-violet-500 to-violet-600';
    if (methodKey === 'nequi') return 'from-fuchsia-500 to-fuchsia-600';
    if (methodKey === 'bancolombia') return 'from-yellow-500 to-amber-600';
    if (methodKey === 'banco_bogota') return 'from-red-500 to-red-600';
    if (methodKey === 'nu') return 'from-gray-500 to-gray-700';
    if (methodKey === 'davivienda') return 'from-orange-500 to-orange-600';
    return 'from-gray-500 to-gray-600';
  };



  const isBankMethodForSummary = (method: string) => {
    const methodKey = normalizePaymentMethodKey(method);
    return isBankPaymentMethod(methodKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#C4DFE6]/10 p-4 md:p-6">
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
                <h1 className="text-3xl font-bold text-gray-800">{t('title')}</h1>
                <p className="text-gray-600">{t('subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#C4DFE6] focus:border-transparent transition-all bg-white font-medium"
              >
                <option value="today">{t('reports:labels.today')}</option>
                <option value="week">{t('reports:labels.week')}</option>
                <option value="month">{t('reports:labels.month')}</option>
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
          onRetry={loadReports}
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
                    {t('reports:labels.totalSales')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">{t('labels.totalSales')}</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{fmtPrice(metrics.totalSales)}</p>
                  <p className="text-xs sm:text-sm opacity-80">{metrics.salesCount} {t('reports:labels.transactions')}</p>
                </div>
              </motion.div>

              {/* Compras Totales */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                    {t('reports:labels.totalPurchases')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">{t('labels.totalPurchases')}</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{fmtPrice(metrics.totalPurchases)}</p>
                  <p className="text-xs sm:text-sm opacity-80">{metrics.purchasesCount} {t('reports:labels.totalPurchases')}</p>
                </div>
              </motion.div>

              {/* Ganancia Bruta */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className={`bg-gradient-to-br ${
                  metrics.grossProfit >= 0 
                    ? 'from-gray-500 to-gray-600' 
                    : 'from-red-500 to-red-600'
                } rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all`}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white/20 px-2 py-1 rounded-lg">
                    {metrics.grossProfit >= 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {metrics.grossProfit >= 0 ? t('reports:labels.profit') : t('reports:labels.loss')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-90">{t('labels.grossProfit')}</p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">{fmtPrice(metrics.grossProfit)}</p>
                  <p className="text-xs sm:text-sm opacity-80">
                    {metrics.grossProfit >= 0 ? t('metrics.positive') + ' ✓' : t('metrics.negative') + ' ⚠'}
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
                  <p className="text-xs sm:text-sm opacity-90">{t('reports:labels.invoicesGenerated')}</p>
                  <p className="text-2xl sm:text-3xl font-bold">{metrics.totalInvoices}</p>
                  <p className="text-xs sm:text-sm opacity-80">{t('reports:labels.inThisPeriod')}</p>
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
                  <div className="p-3 bg-gradient-to-br from-accent-500/10 to-[#C4DFE6]/10 rounded-xl">
                    <Package className="w-8 h-8 text-accent-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-800">{metrics.productsInStock}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">{t('reports:labels.activeProducts')}</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-accent-500 to-[#C4DFE6]" style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Stock Bajo */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    metrics.lowStockProducts > 0 
                      ? 'bg-red-100' 
                      : 'bg-green-100'
                  }`}>
                    <AlertTriangle className={`w-8 h-8 ${
                      metrics.lowStockProducts > 0 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`} />
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      metrics.lowStockProducts > 0 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>{metrics.lowStockProducts}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">{t('reports:labels.lowStock')}</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      metrics.lowStockProducts > 0 
                        ? 'bg-gradient-to-r from-red-500 to-red-600' 
                        : 'bg-gradient-to-r from-green-500 to-green-600'
                    }`} 
                    style={{ width: metrics.productsInStock > 0 ? `${(metrics.lowStockProducts / metrics.productsInStock) * 100}%` : '0%' }}
                  ></div>
                </div>
              </div>

              {/* Proveedores */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
                    <Building2 className="w-8 h-8 text-gray-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-800">{metrics.totalSuppliers}</p>
                  </div>
                </div>
                <p className="text-gray-600 font-medium">{t('reports:labels.activeSuppliers')}</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-gray-500 to-gray-600" style={{ width: '100%' }}></div>
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
                      <h3 className="text-xl font-bold">{t('reports:labels.top5Products')}</h3>
                      <p className="text-white/80">{t('reports:labels.bestSellers')}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {topProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <PieChart className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500">{t('reports:labels.noDataAvailable')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topProducts.map((producto, index) => (
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
                            {producto.quantity} {t('reports:labels.sold')}
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
                      <h3 className="text-xl font-bold">{t('reports:labels.paymentMethods')}</h3>
                      <p className="text-white/80">{t('reports:labels.salesBreakdown')}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {salesByMethod.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <CreditCard className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500">{t('reports:labels.noDataAvailable')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {salesByMethod.map((metodo, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {isBankMethodForSummary(metodo.method) ? (
                              <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                <PaymentMethodBankLogo
                                  method={metodo.method}
                                  sizeClass="h-6"
                                  fallback={<Building2 className="w-5 h-5 text-gray-600" />}
                                />
                              </div>
                            ) : (
                              <div className={`p-2 bg-gradient-to-br ${getPaymentMethodColor(metodo.method)} rounded-lg text-white`}>
                                {getPaymentMethodIcon(metodo.method)}
                              </div>
                            )}
                            <span className="font-semibold text-gray-800">{getPaymentMethodLabel(metodo.method, t)}</span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            {fmtPrice(metodo.total)}
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

export default Reports;
