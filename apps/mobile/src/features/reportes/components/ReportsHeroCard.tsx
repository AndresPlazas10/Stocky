import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { ReportesPeriod, ReportesSnapshot } from '../../../domain/reportes/contracts';
import { reportesStyles as s } from '../reportesStyles';
import { formatShortDateTime, getPeriodLabel } from '../reportesUtils';

interface ReportsHeroCardProps {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
  period: ReportesPeriod;
  snapshot: ReportesSnapshot | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function ReportsHeroCard({
  businessId,
  businessName,
  source,
  period,
  snapshot,
  refreshing,
  onRefresh,
}: ReportsHeroCardProps) {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={['#0F4C81', '#2563EB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.heroCard}
    >
      <View style={s.heroTop}>
        <View style={s.heroIconWrap}>
          <Ionicons name="bar-chart-outline" size={34} color="#D1D5DB" />
        </View>
        <View style={s.heroTextWrap}>
          <Text style={s.heroTitle}>{t('reportes.title')}</Text>
          <Text style={s.heroSubtitle}>{businessName || businessId}</Text>
          <Text style={s.heroMeta}>
            {source === 'owner' ? t('reportes.ownerProfile') : t('reportes.employeeProfile')}
          </Text>
        </View>
      </View>

      <View style={s.heroBottom}>
        <Text style={s.heroMeta}>
          {t('reportes.period')} {getPeriodLabel(period)}
        </Text>
        <Text style={s.heroMeta}>
          {t('reportes.updated')} {snapshot ? formatShortDateTime(snapshot.generatedAt) : 'n/a'}
        </Text>
        <Pressable
          style={[s.refreshButton, refreshing && s.buttonDisabled]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={18} color="#D1D5DB" />
          <Text style={s.refreshButtonText}>
            {refreshing ? t('reportes.updating') : t('reportes.refresh')}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
