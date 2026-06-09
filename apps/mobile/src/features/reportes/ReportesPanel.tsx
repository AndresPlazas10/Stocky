import { ActivityIndicator, View } from 'react-native';
import { STOCKY_COLORS } from '../../theme/tokens';
import { reportesStyles as s } from './reportesStyles';
import { ReportsHeroCard } from './components/ReportsHeroCard';
import { PeriodSelector } from './components/PeriodSelector';
import { KpiGrid } from './components/KpiGrid';
import { FinancialSummary } from './components/FinancialSummary';
import { FinanceBarChart } from './components/FinanceBarChart';
import { PaymentBreakdown } from './components/PaymentBreakdown';
import { PaymentPieChart } from './components/PaymentPieChart';
import { TopSellers } from './components/TopSellers';
import { TopSellersChart } from './components/TopSellersChart';
import { Insights } from './components/Insights';
import { useReportesData } from './hooks/useReportesData';

type Props = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

export function ReportesPanel({ businessId, businessName, source }: Props) {
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

      <FinanceBarChart
        data={data.financeBarData}
        width={data.chartWidth}
        height={data.chartHeight}
        chartConfig={data.chartConfig}
      />

      <PaymentBreakdown
        items={data.snapshot?.paymentBreakdown || []}
        ventasTotal={data.ventasTotal}
      />

      <PaymentPieChart
        data={data.paymentPieData}
        width={data.chartWidth}
        height={data.chartHeight}
        chartConfig={data.chartConfig}
      />

      <TopSellers items={data.snapshot?.topSellers || []} />

      <TopSellersChart
        data={data.sellerBarData}
        width={data.chartWidth}
        height={data.chartHeight}
        chartConfig={data.chartConfig}
      />

      <Insights items={data.insights} />
    </View>
  );
}
