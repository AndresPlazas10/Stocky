import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../../theme/tokens';
import { reportesStyles as s } from './reportesStyles';
import { ReportsHeroCard } from './components/ReportsHeroCard';
import { PeriodSelector } from './components/PeriodSelector';
import { KpiGrid } from './components/KpiGrid';
import { FinancialSummary } from './components/FinancialSummary';
import { PaymentBreakdown } from './components/PaymentBreakdown';
import { TopSellers } from './components/TopSellers';
import { Insights } from './components/Insights';
import { useReportesData } from './hooks/useReportesData';

const LazyFinanceBarChart = React.lazy(() => import('./components/FinanceBarChart'));
const LazyPaymentPieChart = React.lazy(() => import('./components/PaymentPieChart'));
const LazyTopSellersChart = React.lazy(() => import('./components/TopSellersChart'));

type Props = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

export function ReportesPanel({ businessId, businessName, source }: Props) {
  const { t } = useTranslation();
  const data = useReportesData({ businessId });

  if (data.loading && !data.snapshot) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ReportsHeroCard
        businessId={businessId}
        businessName={businessName}
        source={source}
        period={data.period}
        snapshot={data.snapshot}
        refreshing={data.refreshing}
        onRefresh={() => data.loadReportes('refresh')}
      />

      <PeriodSelector period={data.period} onPeriodChange={data.setPeriod} />

      <KpiGrid
        ventasCount={data.ventasCount}
        comprasCount={data.comprasCount}
        avgTicket={data.avgTicket}
        grossResult={data.grossResult}
      />

      <FinancialSummary
        ventasTotal={data.ventasTotal}
        comprasTotal={data.comprasTotal}
        grossResult={data.grossResult}
        grossPercent={data.grossPercent}
      />

      <Suspense fallback={null}>
        <LazyFinanceBarChart
          data={data.financeBarData}
          width={data.chartWidth}
          height={data.chartHeight}
          chartConfig={data.chartConfig}
        />
      </Suspense>

      <PaymentBreakdown
        items={data.snapshot?.paymentBreakdown || []}
        ventasTotal={data.ventasTotal}
      />

      <Suspense fallback={null}>
        <LazyPaymentPieChart
          data={data.paymentPieData}
          width={data.chartWidth}
          height={data.chartHeight}
          chartConfig={data.chartConfig}
        />
      </Suspense>

      <TopSellers items={data.snapshot?.topSellers || []} />

      <Suspense fallback={null}>
        <LazyTopSellersChart
          data={data.sellerBarData}
          width={data.chartWidth}
          height={data.chartHeight}
          chartConfig={data.chartConfig}
        />
      </Suspense>

      <Insights items={data.insights} />
    </View>
  );
}
