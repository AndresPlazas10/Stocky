import { StyleSheet, Text, View } from 'react-native';
import { STOCKY_RADIUS } from '../../../theme/tokens';
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
    <View style={styles.shortageContainer}>
      {insufficientItems.length > 0 ? (
        <View style={styles.shortageBlock}>
          <Text style={styles.shortageTitle}>
            Stock insuficiente en productos ({insufficientItems.length})
          </Text>
          {insufficientItems.slice(0, 5).map((item) => (
            <Text key={`${item.product_id}-${item.quantity}`} style={styles.shortageItem}>
              {item.product_name}: disp {item.available_stock} / req {item.quantity}
            </Text>
          ))}
        </View>
      ) : null}

      {insufficientComboComponents.length > 0 ? (
        <View style={styles.shortageBlock}>
          <Text style={styles.shortageTitle}>
            Stock insuficiente en componentes de combos ({insufficientComboComponents.length})
          </Text>
          {insufficientComboComponents.slice(0, 5).map((item) => (
            <Text key={item.product_id} style={styles.shortageItem}>
              {item.product_name}: disp {item.available_stock} / req {item.required_quantity}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shortageContainer: {
    gap: 8,
    marginTop: 4,
  },
  shortageBlock: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(254, 226, 226, 0.72)',
    padding: 10,
    gap: 4,
  },
  shortageTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  shortageItem: {
    color: '#7F1D1D',
    fontSize: 11,
    fontWeight: '600',
  },
});
