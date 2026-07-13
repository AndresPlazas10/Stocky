import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ReportesPeriod } from '../../../domain/reportes/contracts';
import { reportesStyles as s } from '../reportesStyles';
import { PERIOD_OPTIONS } from '../reportesUtils';

interface PeriodSelectorProps {
  period: ReportesPeriod;
  onPeriodChange: (period: ReportesPeriod) => void;
}

export function PeriodSelector({ period, onPeriodChange }: PeriodSelectorProps) {
  const { t } = useTranslation();
  return (
    <View style={s.periodCard}>
      <Text style={s.sectionTitle}>{t('reportes.periodSelector')}</Text>
      <View style={s.periodGrid}>
        {PERIOD_OPTIONS.map((option) => {
          const selected = option.value === period;
          return (
            <Pressable
              key={option.value}
              onPress={() => onPeriodChange(option.value)}
              style={[s.periodItem, selected && s.periodItemSelected]}
            >
              <Text style={[s.periodText, selected && s.periodTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
