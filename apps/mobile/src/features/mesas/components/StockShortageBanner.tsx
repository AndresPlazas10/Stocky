import { StyleSheet, Text, View } from 'react-native';
import type { ComboComponentShortage, StockShortage } from '../../../services/mesaOrderService';

interface StockShortageBannerProps {
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
}

export function StockShortageBanner({
  insufficientItems,
  insufficientComboComponents,
}: StockShortageBannerProps) {
  if (insufficientItems.length === 0 && insufficientComboComponents.length === 0) return null;

  return (
    <View style={styles.container}>
      {insufficientItems.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.title}>Stock insuficiente en productos ({insufficientItems.length})</Text>
          {insufficientItems.slice(0, 5).map((item) => (
            <Text key={`${item.product_id}-${item.quantity}`} style={styles.item}>
              {item.product_name}: disp {item.available_stock} / req {item.quantity}
            </Text>
          ))}
        </View>
      ) : null}

      {insufficientComboComponents.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.title}>
            Stock insuficiente en componentes de combos ({insufficientComboComponents.length})
          </Text>
          {insufficientComboComponents.slice(0, 5).map((item) => (
            <Text key={item.product_id} style={styles.item}>
              {item.product_name}: disp {item.available_stock} / req {item.required_quantity}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 12,
  },
  block: {
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  item: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 2,
  },
});
