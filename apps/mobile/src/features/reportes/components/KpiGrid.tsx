import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { reportesStyles as s } from '../reportesStyles';

interface KpiGridProps {
  ventasCount: number;
  comprasCount: number;
  avgTicket: number;
  grossResult: number;
}

export function KpiGrid({ ventasCount, comprasCount, avgTicket, grossResult }: KpiGridProps) {
  return (
    <View style={s.kpiGrid}>
      <View style={s.kpiCard}>
        <View style={s.kpiIconBlue}>
          <Ionicons name="receipt-outline" size={18} color="#1D4ED8" />
        </View>
        <Text style={s.kpiLabel}>Ventas</Text>
        <Text style={s.kpiValue}>{ventasCount}</Text>
      </View>

      <View style={s.kpiCard}>
        <View style={s.kpiIconPurple}>
          <Ionicons name="bag-handle-outline" size={18} color="#7C3AED" />
        </View>
        <Text style={s.kpiLabel}>Compras</Text>
        <Text style={s.kpiValue}>{comprasCount}</Text>
      </View>

      <View style={s.kpiCard}>
        <View style={s.kpiIconGreen}>
          <Ionicons name="cash-outline" size={18} color="#047857" />
        </View>
        <Text style={s.kpiLabel}>Ticket promedio</Text>
        <StockyMoneyText value={avgTicket} style={s.kpiMoney} />
      </View>

      <View style={s.kpiCard}>
        <View style={s.kpiIconSlate}>
          <Ionicons name="trending-up-outline" size={18} color="#334155" />
        </View>
        <Text style={s.kpiLabel}>Resultado</Text>
        <StockyMoneyText value={grossResult} style={[s.kpiMoney, grossResult < 0 && s.kpiDanger]} />
      </View>
    </View>
  );
}
