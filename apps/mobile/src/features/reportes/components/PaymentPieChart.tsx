import { Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
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
  chartConfig: Record<string, any>;
}

export function PaymentPieChart({ data, width, height, chartConfig }: PaymentPieChartProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Distribución por método</Text>
      {data.length === 0 ? (
        <Text style={s.emptyText}>No hay datos para graficar.</Text>
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
