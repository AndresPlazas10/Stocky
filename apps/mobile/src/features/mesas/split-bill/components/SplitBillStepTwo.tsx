import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS } from '../../../../theme/tokens';
import type { MesaOrderItem } from '../../../../services/mesaOrderService';
import { getOrderItemName } from '../../../../services/mesaOrderService';
import { getBankLogoSource, isBankPaymentMethod } from '../../../../utils/paymentMethodBranding';
import {
  PAYMENT_OPTIONS,
  formatCopAmount,
  getPaymentOptionIcon,
  getPaymentOptionLabel,
  type AccountState,
  type ItemAssignments,
} from '../splitBillUtils';
import { splitBillStyles as styles } from '../splitBillStyles';

interface SplitBillStepTwoProps {
  currentAccountIndex: number;
  accountsCount: number;
  currentAccount: { id: number; paymentMethod: string; items: any[]; total: number } | null;
  orderItems: MesaOrderItem[];
  itemAssignments: ItemAssignments;
  isPaymentMenuOpen: boolean;
  resolveItemName?: (item: MesaOrderItem) => string;
  onTogglePaymentMenu: () => void;
  onSelectPaymentMethod: (method: AccountState['paymentMethod']) => void;
  onAdjustQuantity: (itemId: string, accountId: number, delta: number) => void;
  getItemExpectedQuantity: (itemId: string) => number;
}

export function SplitBillStepTwo({
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
  getItemExpectedQuantity,
}: SplitBillStepTwoProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>{`Cuenta ${currentAccountIndex + 1}/${accountsCount}`}</Text>
      {currentAccount ? (
        <>
          <Text style={styles.fieldLabel}>Método de pago</Text>
          <View style={styles.dropdownWrap}>
            <Pressable
              style={styles.dropdownTrigger}
              onPress={onTogglePaymentMenu}
            >
              <View style={styles.dropdownTriggerLeft}>
                {isBankPaymentMethod(currentAccount.paymentMethod as any) ? (
                  <Image source={getBankLogoSource(currentAccount.paymentMethod as any)!} style={styles.paymentLogo} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name={getPaymentOptionIcon(currentAccount.paymentMethod as any) as any}
                    size={16}
                    color={STOCKY_COLORS.textSecondary}
                  />
                )}
                <Text style={styles.dropdownTriggerText}>{getPaymentOptionLabel(currentAccount.paymentMethod as any)}</Text>
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
                        <Image source={getBankLogoSource(option.value)!} style={styles.paymentLogoSmall} resizeMode="contain" />
                      ) : (
                        <Ionicons
                          name={getPaymentOptionIcon(option.value) as any}
                          size={15}
                          color={selected ? '#4F46E5' : STOCKY_COLORS.textSecondary}
                        />
                      )}
                      <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
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
        const selectedQty = Math.max(0, Math.floor(Number(byAccount[currentAccount?.id || 0] || 0)));
        const assignedOthers = Object.entries(byAccount).reduce((sum, [accountId, value]) => {
          if (Number(accountId) === currentAccount?.id) return sum;
          return sum + Math.max(0, Math.floor(Number(value || 0)));
        }, 0);
        const maxForSelected = Math.max(0, expected - assignedOthers);
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
                  <Text style={styles.qtyValueText}>{selectedQty > 0 ? String(selectedQty) : ''}</Text>
                </View>
                <Pressable
                  style={[styles.qtyStepButton, selectedQty >= maxForSelected && styles.actionButtonDisabled]}
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
}
