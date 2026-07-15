import { Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { reportesStyles as s } from '../reportesStyles';

interface FinanceBarChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      colors?: ((opacity?: number) => string)[];
    }[];
  };
  width: number;
  height: number;
  chartConfig: Record<string, unknown>;
}

export default function FinanceBarChart({
  data,
  width,
  height,
  chartConfig,
}: FinanceBarChartProps) {
  const { t } = useTranslation();
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>{t('reportes.salesVsPurchasesChart')}</Text>
      <Text style={s.chartCaption}>{t('reportes.periodTotals')}</Text>
      <View style={s.chartWrap}>
        <BarChart
          data={data}
          width={width}
          height={height}
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
          style={s.chartSurface}
        />
      </View>
    </View>
  );
}
