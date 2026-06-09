import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import type { MesaOrderItem } from '../../../services/mesaOrderService';

interface OrderItemRowProps {
  item: MesaOrderItem;
  itemName: string;
  busy: boolean;
  disabled: boolean;
  onChangeQuantity: (item: MesaOrderItem, delta: number) => void;
}

export const OrderItemRow = memo(function OrderItemRow({
  item,
  itemName,
  busy,
  disabled,
  onChangeQuantity,
}: OrderItemRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text numberOfLines={1} style={styles.name}>{itemName}</Text>
        <StockyMoneyText value={Number(item.subtotal || 0)} style={styles.total} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.unitChip}>
          <Text style={styles.unitChipText}>
            <StockyMoneyText value={Number(item.price || 0)} style={styles.unitChipText} />
            {' '}por unidad
          </Text>
        </View>
        <Text style={styles.subtotalLabel}>Subtotal</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.controlsRow}>
        <View style={styles.stepper}>
          <Pressable
            style={[styles.stepperButton, busy && styles.disabled]}
            onPressIn={() => onChangeQuantity(item, -1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.minusText}>-</Text>
          </Pressable>

          <Text style={styles.qtyText}>{item.quantity}</Text>

          <Pressable
            style={[styles.stepperButton, busy && styles.disabled]}
            onPressIn={() => onChangeQuantity(item, 1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.plusText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  total: {
    fontSize: 16,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  unitChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  subtotalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
  },
  plusText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    minWidth: 32,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
});
