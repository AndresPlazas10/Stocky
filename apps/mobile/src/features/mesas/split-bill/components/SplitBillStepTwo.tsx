import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS } from '../../../../theme/tokens';
import type { PaymentMethod } from '../../../../services/mesaCheckoutService';
import type { MesaOrderItem } from '../../../../services/mesaOrderService';
import { getOrderItemName } from '../../../../services/mesaOrderService';
import { getBankLogoSource, isBankPaymentMethod } from '../../../../utils/paymentMethodBranding';
import { formatCopAmount } from '../../../../utils/money';
import {
  PAYMENT_OPTIONS,
  getPaymentOptionIcon,
  getPaymentOptionLabel,
  type AccountState,
  type ItemAssignments,
} from '../splitBillUtils';
import { splitBillStyles as styles } from '../splitBillStyles';

interface SplitBillStepTwoProps {
  currentAccountIndex: number;
  accountsCount: number;
  currentAccount: { id: number; paymentMethod: string; items: unknown[]; total: number } | null;
  orderItems: MesaOrderItem[];
  itemAssignments: ItemAssignments;
  isPaymentMenuOpen: boolean;
  resolveItemName?: (item: MesaOrderItem) => string;
  onTogglePaymentMenu: () => void;
  onSelectPaymentMethod: (method: AccountState['paymentMethod']) => void;
  onAdjustQuantity: (itemId: string, accountId: number, delta: number) => void;
  getItemExpectedQuantity: (_itemId: string) => number;
}

export const SplitBillStepTwo = React.memo(function SplitBillStepTwo({
  currentAccountIndex,
  accountsCount,
  currentAccount,
  orderItems,
  itemAssignments,
  isPaymentMenuOpen,
  resolveItemName,
  onTogglePaymentMenu,
  onSelectPaymentMethod,
  onAdjustQuantity,
  getItemExpectedQuantity: _getItemExpectedQuantity,
}: SplitBillStepTwoProps) {
  const itemMaxQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of orderItems) {
      const expected = Math.max(0, Math.floor(Number(item.quantity || 0)));
      const byAccount = itemAssignments[item.id] || {};
      let assignedOthers = 0;
      for (const [accountId, value] of Object.entries(byAccount)) {
        if (Number(accountId) === currentAccount?.id) continue;
        assignedOthers += Math.max(0, Math.floor(Number(value || 0)));
      }
      map.set(item.id, Math.max(0, expected - assignedOthers));
    }
    return map;
  }, [orderItems, itemAssignments, currentAccount?.id]);

  return (
    <>
      <Text
        style={styles.sectionTitle}
      >{`Cuenta ${currentAccountIndex + 1}/${accountsCount}`}</Text>
      {currentAccount ? (
        <>
          <Text style={styles.fieldLabel}>Método de pago</Text>
          <View style={styles.dropdownWrap}>
            <Pressable style={styles.dropdownTrigger} onPress={onTogglePaymentMenu}>
              <View style={styles.dropdownTriggerLeft}>
                {isBankPaymentMethod(currentAccount.paymentMethod as PaymentMethod) ? (
                  <Image
                    source={getBankLogoSource(currentAccount.paymentMethod as PaymentMethod)!}
                    style={styles.paymentLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons
                    name={
                      getPaymentOptionIcon(
                        currentAccount.paymentMethod as PaymentMethod,
                      ) as keyof typeof Ionicons.glyphMap
                    }
                    size={16}
                    color={STOCKY_COLORS.textSecondary}
                  />
                )}
                <Text style={styles.dropdownTriggerText}>
                  {getPaymentOptionLabel(currentAccount.paymentMethod as PaymentMethod)}
                </Text>
              </View>
              <Ionicons
                name={isPaymentMenuOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={STOCKY_COLORS.textSecondary}
              />
            </Pressable>

            {isPaymentMenuOpen ? (
              <View style={styles.dropdownMenu}>
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = currentAccount.paymentMethod === option.value;
                  return (
                    <Pressable
                      key={`${currentAccount.id}-${option.value}`}
                      onPress={() => {
                        onSelectPaymentMethod(option.value);
                        onTogglePaymentMenu();
                      }}
                      style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                    >
                      {isBankPaymentMethod(option.value) ? (
                        <Image
                          source={getBankLogoSource(option.value)!}
                          style={styles.paymentLogoSmall}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons
                          name={
                            getPaymentOptionIcon(option.value) as keyof typeof Ionicons.glyphMap
                          }
                          size={15}
                          color={selected ? '#4F46E5' : STOCKY_COLORS.textSecondary}
                        />
                      )}
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selected && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={styles.fieldLabel}>Productos que paga esta cuenta</Text>
      {orderItems.map((item) => {
        const expected = Math.max(0, Math.floor(Number(item.quantity || 0)));
        const byAccount = itemAssignments[item.id] || {};
        const selectedQty = Math.max(
          0,
          Math.floor(Number(byAccount[currentAccount?.id || 0] || 0)),
        );
        const maxForSelected = itemMaxQuantities.get(item.id) ?? 0;
        return (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.assignmentRow}>
              <View style={styles.assignmentInfo}>
                <Text style={styles.assignmentInfoTitle}>
                  {resolveItemName ? resolveItemName(item) : getOrderItemName(item)}
                </Text>
                <Text style={styles.assignmentInfoText}>Máximo disponible: {maxForSelected}</Text>
              </View>
              <View style={styles.assignmentControls}>
                <Pressable
                  style={[styles.qtyStepButton, selectedQty <= 0 && styles.actionButtonDisabled]}
                  onPress={() => currentAccount && onAdjustQuantity(item.id, currentAccount.id, -1)}
                  disabled={!currentAccount || selectedQty <= 0}
                >
                  <Text style={styles.qtyStepText}>-</Text>
                </Pressable>
                <View style={styles.qtyValueBadge}>
                  <Text style={styles.qtyValueText}>
                    {selectedQty > 0 ? String(selectedQty) : ''}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.qtyStepButton,
                    selectedQty >= maxForSelected && styles.actionButtonDisabled,
                  ]}
                  onPress={() => currentAccount && onAdjustQuantity(item.id, currentAccount.id, 1)}
                  disabled={!currentAccount || selectedQty >= maxForSelected}
                >
                  <Text style={styles.qtyStepText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      <View style={styles.accountTotalDueRow}>
        <Text style={styles.accountTotalDueLabel}>Total de esta cuenta</Text>
        <Text style={styles.accountTotalDueValue}>
          {formatCopAmount(currentAccount?.total || 0)}
        </Text>
      </View>
    </>
  );
});
