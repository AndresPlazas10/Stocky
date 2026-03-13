import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { listReportesByBusinessId } from '../../domain/reportes/queries';
import type { ReportesPeriod, ReportesSnapshot } from '../../domain/reportes/contracts';
import { formatCop } from '../../services/mesasService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyMoneyText } from '../../ui/StockyMoneyText';

type Props = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

const PERIOD_OPTIONS: Array<{ value: ReportesPeriod; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Todo' },
];

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getPeriodLabel(period: ReportesPeriod) {
  return PERIOD_OPTIONS.find((item) => item.value === period)?.label || 'Todo';
}

function getPaymentMethodIcon(method: string): keyof typeof Ionicons.glyphMap {
  if (method === 'cash') return 'cash-outline';
  if (method === 'card') return 'card-outline';
  if (method === 'transfer') return 'swap-horizontal-outline';
  if (method === 'mixed') return 'wallet-outline';
  return 'help-circle-outline';
}

export function ReportesPanel({ businessId, businessName, source }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [period, setPeriod] = useState<ReportesPeriod>('30d');
  const [snapshot, setSnapshot] = useState<ReportesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReportes = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const next = await listReportesByBusinessId(businessId, { period });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [businessId, period]);

  useEffect(() => {
    loadReportes('initial');
  }, [loadReportes]);

  const ventasCount = snapshot?.ventasCount || 0;
  const comprasCount = snapshot?.comprasCount || 0;
  const ventasTotal = snapshot?.ventasTotal || 0;
  const comprasTotal = snapshot?.comprasTotal || 0;
  const grossResult = snapshot?.grossResult || 0;
  const avgTicket = snapshot?.avgTicket || 0;

  const grossPercent = useMemo(() => {
    if (ventasTotal <= 0) return 0;
    return (grossResult / ventasTotal) * 100;
  }, [grossResult, ventasTotal]);

  const dominantPayment = useMemo(() => {
    const rows = snapshot?.paymentBreakdown || [];
    return rows.length > 0 ? rows[0] : null;
  }, [snapshot?.paymentBreakdown]);

  const topSeller = useMemo(() => {
    const rows = snapshot?.topSellers || [];
    return rows.length > 0 ? rows[0] : null;
  }, [snapshot?.topSellers]);

  const insights = useMemo(() => {
    const items: string[] = [];

    if (grossResult >= 0) {
      items.push(`Resultado positivo de ${formatCop(grossResult)} en ${getPeriodLabel(period)}.`);
    } else {
      items.push(`Resultado negativo de ${formatCop(Math.abs(grossResult))} en ${getPeriodLabel(period)}.`);
    }

    if (dominantPayment) {
      items.push(`Método dominante: ${dominantPayment.label} (${dominantPayment.count} ventas).`);
    } else {
      items.push('Sin ventas registradas para construir métodos de pago.');
    }

    if (topSeller) {
      items.push(`Vendedor líder: ${topSeller.sellerName} con ${formatCop(topSeller.total)}.`);
    } else {
      items.push('Sin datos de vendedores para el período actual.');
    }

    return items;
  }, [dominantPayment, grossResult, period, topSeller]);

  const chartWidth = Math.max(260, windowWidth - 78);
  const chartHeight = 166;

  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: '#F8FCFD',
    backgroundGradientTo: '#F8FCFD',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(7, 87, 91, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(44, 72, 73, ${opacity})`,
    propsForBackgroundLines: {
      stroke: 'rgba(102, 165, 173, 0.22)',
      strokeDasharray: '',
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 9,
    },
    barPercentage: 0.5,
    barRadius: 5,
  }), []);

  const financeBarData = useMemo(() => ({
    labels: ['Ventas', 'Compras'],
    datasets: [{
      data: [ventasTotal, comprasTotal],
      colors: [
        (opacity = 1) => `rgba(7, 87, 91, ${opacity})`,
        (opacity = 1) => `rgba(153, 27, 27, ${opacity})`,
      ],
    }],
  }), [comprasTotal, ventasTotal]);

  const paymentPieData = useMemo(() => {
    const rows = snapshot?.paymentBreakdown || [];
    const palette = ['#07575B', '#66A5AD', '#2563EB', '#0EA5A4', '#F59E0B', '#DC2626'];
    return rows
      .filter((row) => Number(row.total || 0) > 0)
      .map((row, index) => ({
        name: row.label,
        population: Number(row.total || 0),
        color: palette[index % palette.length],
        legendFontColor: '#334155',
        legendFontSize: 11,
      }));
  }, [snapshot?.paymentBreakdown]);

  const sellerBarData = useMemo(() => {
    const rows = snapshot?.topSellers || [];
    return {
      labels: rows.map((row) => (
        row.sellerName.length > 7
          ? `${row.sellerName.slice(0, 7)}…`
          : row.sellerName
      )),
      datasets: [{ data: rows.map((row) => Number(row.total || 0)) }],
    };
  }, [snapshot?.topSellers]);

  if (loading && !snapshot) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F4C81', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="bar-chart-outline" size={34} color="#D1D5DB" />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Reportes</Text>
            <Text style={styles.heroSubtitle}>{businessName || businessId}</Text>
            <Text style={styles.heroMeta}>Perfil: {source === 'owner' ? 'Propietario' : 'Empleado'}</Text>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <Text style={styles.heroMeta}>Periodo: {getPeriodLabel(period)}</Text>
          <Text style={styles.heroMeta}>
            Actualizado: {snapshot ? formatShortDateTime(snapshot.generatedAt) : 'n/a'}
          </Text>
          <Pressable
            style={[styles.refreshButton, refreshing && styles.buttonDisabled]}
            onPress={() => loadReportes('refresh')}
            disabled={refreshing}
          >
            <Ionicons name="refresh-outline" size={18} color="#D1D5DB" />
            <Text style={styles.refreshButtonText}>{refreshing ? 'Actualizando...' : 'Actualizar'}</Text>
          </Pressable>
        </View>
      </LinearGradient>


      <View style={styles.periodCard}>
        <Text style={styles.sectionTitle}>Periodo del reporte</Text>
        <View style={styles.periodGrid}>
          {PERIOD_OPTIONS.map((option) => {
            const selected = option.value === period;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPeriod(option.value)}
                style={[styles.periodItem, selected && styles.periodItemSelected]}
              >
                <Text style={[styles.periodText, selected && styles.periodTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconBlue}>
            <Ionicons name="receipt-outline" size={18} color="#1D4ED8" />
          </View>
          <Text style={styles.kpiLabel}>Ventas</Text>
          <Text style={styles.kpiValue}>{ventasCount}</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiIconPurple}>
            <Ionicons name="bag-handle-outline" size={18} color="#7C3AED" />
          </View>
          <Text style={styles.kpiLabel}>Compras</Text>
          <Text style={styles.kpiValue}>{comprasCount}</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiIconGreen}>
            <Ionicons name="cash-outline" size={18} color="#047857" />
          </View>
          <Text style={styles.kpiLabel}>Ticket promedio</Text>
          <StockyMoneyText value={avgTicket} style={styles.kpiMoney} />
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiIconSlate}>
            <Ionicons name="trending-up-outline" size={18} color="#334155" />
          </View>
          <Text style={styles.kpiLabel}>Resultado</Text>
          <StockyMoneyText value={grossResult} style={[styles.kpiMoney, grossResult < 0 && styles.kpiDanger]} />
        </View>
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Resumen financiero</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Ventas totales</Text>
          <StockyMoneyText value={ventasTotal} style={styles.summaryValue} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Compras totales</Text>
          <StockyMoneyText value={comprasTotal} style={styles.summaryValue} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Margen bruto</Text>
          <Text style={[styles.summaryValue, grossResult < 0 && styles.kpiDanger]}>
            {Number.isFinite(grossPercent) ? `${grossPercent.toFixed(1)}%` : '0.0%'}
          </Text>
        </View>
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Comparativo Ventas vs Compras</Text>
        <Text style={styles.chartCaption}>Valores totales del periodo seleccionado</Text>
        <View style={styles.chartWrap}>
          <BarChart
            data={financeBarData}
            width={chartWidth}
            height={chartHeight}
            yAxisLabel="$"
            yAxisSuffix=""
            fromZero
            chartConfig={chartConfig}
            showBarTops={false}
            withInnerLines
            withHorizontalLabels
            withVerticalLabels
            withCustomBarColorFromData
            flatColor
            style={styles.chartSurface}
          />
        </View>
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Métodos de pago</Text>
        {(snapshot?.paymentBreakdown || []).length === 0 ? (
          <Text style={styles.emptyText}>No hay ventas para mostrar en este período.</Text>
        ) : (
          (snapshot?.paymentBreakdown || []).map((item) => {
            const share = ventasTotal > 0 ? (item.total / ventasTotal) * 100 : 0;
            return (
              <View key={item.method} style={styles.breakdownItem}>
                <View style={styles.breakdownTop}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name={getPaymentMethodIcon(item.method)} size={19} color="#334155" />
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                  </View>
                  <StockyMoneyText value={item.total} style={styles.breakdownValue} />
                </View>
                <View style={styles.breakdownMetaRow}>
                  <Text style={styles.breakdownMeta}>{item.count} transacciones</Text>
                  <Text style={styles.breakdownMeta}>{share.toFixed(1)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, share))}%` }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Distribución por método</Text>
        {paymentPieData.length === 0 ? (
          <Text style={styles.emptyText}>No hay datos para graficar.</Text>
        ) : (
          <View style={styles.chartWrap}>
            <PieChart
              data={paymentPieData}
              width={chartWidth}
              height={chartHeight}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="12"
              chartConfig={chartConfig}
              absolute={false}
              hasLegend
            />
          </View>
        )}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Top vendedores</Text>
        {(snapshot?.topSellers || []).length === 0 ? (
          <Text style={styles.emptyText}>No hay ventas asignadas a vendedores en este período.</Text>
        ) : (
          (snapshot?.topSellers || []).map((item, index) => (
            <View key={item.sellerName} style={styles.sellerRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View style={styles.sellerMain}>
                <Text style={styles.sellerName}>{item.sellerName}</Text>
                <Text style={styles.sellerMeta}>{item.count} ventas</Text>
              </View>
              <StockyMoneyText value={item.total} style={styles.sellerTotal} />
            </View>
          ))
        )}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Top vendedores (gráfico)</Text>
        {(sellerBarData.datasets[0]?.data || []).length === 0 ? (
          <Text style={styles.emptyText}>No hay vendedores para graficar.</Text>
        ) : (
          <View style={styles.chartWrap}>
            <BarChart
              data={sellerBarData}
              width={chartWidth}
              height={chartHeight}
              yAxisLabel="$"
              yAxisSuffix=""
              fromZero
              chartConfig={chartConfig}
              withInnerLines
              withVerticalLabels
              withHorizontalLabels
              withCustomBarColorFromData
              flatColor
              style={styles.chartSurface}
            />
          </View>
        )}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.sectionTitle}>Insights</Text>
        {insights.map((item) => (
          <View key={item} style={styles.insightRow}>
            <Ionicons name="sparkles-outline" size={16} color="#334155" />
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 20,
    padding: 12,
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
    gap: 1,
  },
  heroTitle: {
    color: '#E5E7EB',
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  heroMeta: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  heroBottom: {
    gap: 4,
  },
  refreshButton: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  refreshButtonText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  periodCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodItem: {
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    borderRadius: STOCKY_RADIUS.md,
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.surface,
  },
  periodItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderColor: '#2563EB',
  },
  periodText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  periodTextSelected: {
    color: '#1D4ED8',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    gap: 4,
  },
  kpiIconBlue: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconPurple: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconGreen: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconSlate: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  kpiValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  kpiMoney: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  kpiDanger: {
    color: '#B91C1C',
  },
  blockCard: {
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownItem: {
    gap: 4,
  },
  breakdownTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownLabel: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: STOCKY_COLORS.primary700,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(102, 165, 173, 0.22)',
    backgroundColor: '#F8FCFD',
    paddingVertical: 6,
  },
  chartSurface: {
    borderRadius: 12,
  },
  chartCaption: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
  },
  sellerMain: {
    flex: 1,
    gap: 1,
  },
  sellerName: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sellerMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  sellerTotal: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  insightText: {
    flex: 1,
    color: STOCKY_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  emptyText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
