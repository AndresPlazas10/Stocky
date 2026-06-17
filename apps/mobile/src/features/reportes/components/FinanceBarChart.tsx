import { Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
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

export function FinanceBarChart({ data, width, height, chartConfig }: FinanceBarChartProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Comparativo Ventas vs Compras</Text>
      <Text style={s.chartCaption}>Valores totales del periodo seleccionado</Text>
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
