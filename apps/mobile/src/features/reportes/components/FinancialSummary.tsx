import { Text, View } from 'react-native';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { reportesStyles as s } from '../reportesStyles';

interface FinancialSummaryProps {
  ventasTotal: number;
  comprasTotal: number;
  grossResult: number;
  grossPercent: number;
}

export function FinancialSummary({
  ventasTotal,
  comprasTotal,
  grossResult,
  grossPercent,
}: FinancialSummaryProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Resumen financiero</Text>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>Ventas totales</Text>
        <StockyMoneyText value={ventasTotal} style={s.summaryValue} />
      </View>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>Compras totales</Text>
        <StockyMoneyText value={comprasTotal} style={s.summaryValue} />
      </View>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>Margen bruto</Text>
        <Text style={[s.summaryValue, grossResult < 0 && s.kpiDanger]}>
          {Number.isFinite(grossPercent) ? `${grossPercent.toFixed(1)}%` : '0.0%'}
        </Text>
      </View>
    </View>
  );
}
