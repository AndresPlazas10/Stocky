import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listReportesByBusinessId } from '../../../domain/reportes/queries';
import type { ReportesPeriod, ReportesSnapshot } from '../../../domain/reportes/contracts';
import { formatCop } from '../../../utils/money';
import { getPeriodLabel } from '../reportesUtils';

type UseReportesDataParams = {
  businessId: string;
};

export function useReportesData({ businessId }: UseReportesDataParams) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [period, setPeriod] = useState<ReportesPeriod>('30d');
  const [snapshot, setSnapshot] = useState<ReportesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReportes = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const next = await listReportesByBusinessId(businessId, { period });
        setSnapshot(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reportesSection.loadError'));
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [businessId, period],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadReportes('initial');
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
      items.push(`${t('reportesSection.positiveResult')} ${formatCop(grossResult)}.`);
    } else {
      items.push(`${t('reportesSection.negativeResult')} ${formatCop(Math.abs(grossResult))}.`);
    }

    if (dominantPayment) {
      items.push(
        `${t('reportesSection.dominantMethod')} ${dominantPayment.label} (${dominantPayment.count} ${t('reportes.sales')}).`,
      );
    } else {
      items.push(t('reportesSection.noPaymentMethods'));
    }

    if (topSeller) {
      items.push(
        `${t('reportesSection.topSeller')} ${topSeller.sellerName} ${formatCop(topSeller.total)}.`,
      );
    } else {
      items.push(t('reportesSection.noSellerData'));
    }

    return items;
  }, [dominantPayment, grossResult, period, topSeller]);

  const chartWidth = Math.max(260, windowWidth - 78);
  const chartHeight = 166;

  const chartConfig = useMemo(
    () => ({
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
    }),
    [],
  );

  const financeBarData = useMemo(
    () => ({
      labels: [t('reportes.sales'), t('reportes.purchases')],
      datasets: [
        {
          data: [ventasTotal, comprasTotal],
          colors: [
            (opacity = 1) => `rgba(7, 87, 91, ${opacity})`,
            (opacity = 1) => `rgba(153, 27, 27, ${opacity})`,
          ],
        },
      ],
    }),
    [comprasTotal, ventasTotal],
  );

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
      labels: rows.map((row) =>
        row.sellerName.length > 7 ? `${row.sellerName.slice(0, 7)}…` : row.sellerName,
      ),
      datasets: [{ data: rows.map((row) => Number(row.total || 0)) }],
    };
  }, [snapshot?.topSellers]);

  return {
    period,
    setPeriod,
    snapshot,
    loading,
    refreshing,
    error,
    loadReportes,
    ventasCount,
    comprasCount,
    ventasTotal,
    comprasTotal,
    grossResult,
    avgTicket,
    grossPercent,
    dominantPayment,
    topSeller,
    insights,
    chartWidth,
    chartHeight,
    chartConfig,
    financeBarData,
    paymentPieData,
    sellerBarData,
  };
}

export type UseReportesDataReturn = ReturnType<typeof useReportesData>;
