import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
          <Text style={s.heroTitle}>Reportes</Text>
          <Text style={s.heroSubtitle}>{businessName || businessId}</Text>
          <Text style={s.heroMeta}>Perfil: {source === 'owner' ? 'Propietario' : 'Empleado'}</Text>
        </View>
      </View>

      <View style={s.heroBottom}>
        <Text style={s.heroMeta}>Periodo: {getPeriodLabel(period)}</Text>
        <Text style={s.heroMeta}>
          Actualizado: {snapshot ? formatShortDateTime(snapshot.generatedAt) : 'n/a'}
        </Text>
        <Pressable
          style={[s.refreshButton, refreshing && s.buttonDisabled]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons name="refresh-outline" size={18} color="#D1D5DB" />
          <Text style={s.refreshButtonText}>{refreshing ? 'Actualizando...' : 'Actualizar'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
