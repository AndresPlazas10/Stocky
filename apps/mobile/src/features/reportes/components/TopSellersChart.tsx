import { Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { reportesStyles as s } from '../reportesStyles';

interface TopSellersChartProps {
  data: {
    labels: string[];
    datasets: Array<{ data: number[] }>;
  };
  width: number;
  height: number;
  chartConfig: Record<string, any>;
}

export function TopSellersChart({ data, width, height, chartConfig }: TopSellersChartProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Top vendedores (gráfico)</Text>
      {(data.datasets[0]?.data || []).length === 0 ? (
        <Text style={s.emptyText}>No hay vendedores para graficar.</Text>
      ) : (
        <View style={s.chartWrap}>
          <BarChart
            data={data}
            width={width}
            height={height}
            yAxisLabel="$"
            yAxisSuffix=""
            fromZero
            chartConfig={chartConfig}
            withInnerLines
            withVerticalLabels
            withHorizontalLabels
            withCustomBarColorFromData
            flatColor
            style={s.chartSurface}
          />
        </View>
      )}
    </View>
  );
}
