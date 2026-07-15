import { Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { reportesStyles as s } from '../reportesStyles';

interface PaymentPieDataItem {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

interface PaymentPieChartProps {
  data: PaymentPieDataItem[];
  width: number;
  height: number;
  chartConfig: Record<string, unknown>;
}

export default function PaymentPieChart({
  data,
  width,
  height,
  chartConfig,
}: PaymentPieChartProps) {
  const { t } = useTranslation();
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>{t('reportes.paymentDistribution')}</Text>
      {data.length === 0 ? (
        <Text style={s.emptyText}>{t('reportes.noChartData')}</Text>
      ) : (
        <View style={s.chartWrap}>
          <PieChart
            data={data}
            width={width}
            height={height}
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
  );
}
