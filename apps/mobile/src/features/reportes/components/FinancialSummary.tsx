import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>{t('reportes.financialSummary')}</Text>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>{t('reportes.totalSales')}</Text>
        <StockyMoneyText value={ventasTotal} style={s.summaryValue} />
      </View>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>{t('reportes.totalPurchases')}</Text>
        <StockyMoneyText value={comprasTotal} style={s.summaryValue} />
      </View>
      <View style={s.summaryRow}>
        <Text style={s.summaryLabel}>{t('reportes.grossMargin')}</Text>
        <Text style={[s.summaryValue, grossResult < 0 && s.kpiDanger]}>
          {Number.isFinite(grossPercent) ? `${grossPercent.toFixed(1)}%` : '0.0%'}
        </Text>
      </View>
    </View>
  );
}
