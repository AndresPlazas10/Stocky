import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('mesas');

  return (
    <View style={styles.orderItemCard}>
      <View style={styles.orderItemTopRow}>
        <Text numberOfLines={1} style={styles.orderItemName}>
          {itemName}
        </Text>
        <StockyMoneyText value={Number(item.subtotal || 0)} style={styles.orderItemTotal} />
      </View>

      <View style={styles.orderItemMetaRow}>
        <View style={styles.orderItemUnitChip}>
          <Text style={styles.orderItemUnitChipText}>
            <StockyMoneyText value={Number(item.price || 0)} style={styles.orderItemUnitChipText} />{' '}
            {t('labels.perUnit', { defaultValue: 'por unidad' })}
          </Text>
        </View>
        <Text style={styles.orderItemSubtotalLabel}>
          {t('labels.subtotal', { defaultValue: 'Subtotal' })}
        </Text>
      </View>

      <View style={styles.orderItemDivider} />

      <View style={styles.orderItemControlsRow}>
        <View style={styles.orderItemStepper}>
          <Pressable
            style={[styles.orderItemStepperButton, busy && styles.actionButtonDisabled]}
            onPressIn={() => onChangeQuantity(item, -1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.orderItemMinusText}>-</Text>
          </Pressable>

          <Text style={styles.orderItemQtyText}>{item.quantity}</Text>

          <Pressable
            style={[styles.orderItemStepperButton, busy && styles.actionButtonDisabled]}
            onPressIn={() => onChangeQuantity(item, 1)}
            disabled={busy || disabled}
            hitSlop={10}
            pressRetentionOffset={10}
          >
            <Text style={styles.orderItemPlusText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  orderItemCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  orderItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderItemName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  orderItemTotal: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  orderItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderItemUnitChip: {
    borderRadius: 10,
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderItemUnitChipText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
  orderItemSubtotalLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '500',
  },
  orderItemDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 2,
  },
  orderItemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  orderItemStepper: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderItemStepperButton: {
    width: 34,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  orderItemMinusText: {
    color: '#BE123C',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemPlusText: {
    color: '#16A34A',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemQtyText: {
    minWidth: 34,
    textAlign: 'center',
    color: '#111827',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
});
