import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { getBankLogoSource, isBankPaymentMethod } from '../../../utils/paymentMethodBranding';
import { getPaymentMethodIcon } from '../../../utils/paymentMethods';
import { reportesStyles as s } from '../reportesStyles';

interface PaymentBreakdownItem {
  method: string;
  label: string;
  total: number;
  count: number;
}

interface PaymentBreakdownProps {
  items: PaymentBreakdownItem[];
  ventasTotal: number;
}

export function PaymentBreakdown({ items, ventasTotal }: PaymentBreakdownProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Métodos de pago</Text>
      {items.length === 0 ? (
        <Text style={s.emptyText}>No hay ventas para mostrar en este período.</Text>
      ) : (
        items.map((item) => {
          const share = ventasTotal > 0 ? (item.total / ventasTotal) * 100 : 0;
          return (
            <View key={item.method} style={s.breakdownItem}>
              <View style={s.breakdownTop}>
                <View style={s.breakdownLeft}>
                  {isBankPaymentMethod(item.method) ? (
                    <Image
                      source={getBankLogoSource(item.method)!}
                      style={s.breakdownLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name={getPaymentMethodIcon(item.method)} size={19} color="#334155" />
                  )}
                  <Text style={s.breakdownLabel}>{item.label}</Text>
                </View>
                <StockyMoneyText value={item.total} style={s.breakdownValue} />
              </View>
              <View style={s.breakdownMetaRow}>
                <Text style={s.breakdownMeta}>{item.count} transacciones</Text>
                <Text style={s.breakdownMeta}>{share.toFixed(1)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View
                  style={[s.progressFill, { width: `${Math.max(0, Math.min(100, share))}%` }]}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
