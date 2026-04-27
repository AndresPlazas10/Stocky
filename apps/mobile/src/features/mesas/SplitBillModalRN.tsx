import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyModal } from '../../ui/StockyModal';
import type { MesaOrderItem } from '../../services/mesaOrderService';
import { getOrderItemName } from '../../services/mesaOrderService';
import type { PaymentMethod, SplitSubAccount } from '../../services/mesaCheckoutService';
import { getBankLogoSource, isBankPaymentMethod } from '../../utils/paymentMethodBranding';

const MAX_SUB_ACCOUNTS = 10;
const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'banco_bogota', label: 'Banco de Bogotá' },
  { value: 'nu', label: 'Nu' },
  { value: 'davivienda', label: 'Davivienda' },
];

function getPaymentOptionIcon(method: PaymentMethod): keyof typeof Ionicons.glyphMap {
  if (method === 'cash') return 'cash-outline';
  if (method === 'card') return 'card-outline';
  if (method === 'transfer') return 'swap-horizontal-outline';
  if (method === 'mixed') return 'wallet-outline';
  if (['nequi', 'bancolombia', 'banco_bogota', 'nu', 'davivienda'].includes(method)) return 'business-outline';
  return 'help-circle-outline';
}

function getPaymentOptionLabel(method: PaymentMethod) {
  return PAYMENT_OPTIONS.find((option) => option.value === method)?.label || 'Seleccionar';
}

function formatCopAmount(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO').format(Math.max(0, Math.round(Number(value) || 0)))} COP`;
}

type AccountState = {
  id: number;
  name: string;
  paymentMethod: PaymentMethod;
  amountReceived: string;
};

type Props = {
  visible: boolean;
  orderItems: MesaOrderItem[];
  submitting?: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (payload: { subAccounts: SplitSubAccount[] }) => void;
};

function parseCopAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
}

function calculateCashChange(total: number, paidValue: string | number | null | undefined) {
  const normalizedTotal = Math.round(Number(total) || 0);
  const normalizedPaid = parseCopAmount(paidValue);

  if (normalizedTotal <= 0 || !Number.isFinite(normalizedPaid) || normalizedPaid < normalizedTotal) {
    return { isValid: false, change: 0, breakdown: [], paid: null as number | null };
  }

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown: Array<{ denomination: number; count: number }> = [];
  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    change: normalizedPaid - normalizedTotal,
    breakdown,
    paid: normalizedPaid,
  };
}

function getInitialAssignments(orderItems: MesaOrderItem[]) {
  const initial: Record<string, Record<number, number>> = {};
  orderItems.forEach((item) => {
    initial[item.id] = {};
  });
  return initial;
}

export function SplitBillModalRN({
  visible,
  orderItems,
  submitting = false,
  onBack,
  onClose,
  onConfirm,
}: Props) {
  const [accounts, setAccounts] = useState<AccountState[]>([
    { id: 1, name: 'Cuenta 1', paymentMethod: 'cash', amountReceived: '' },
  ]);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [itemAssignments, setItemAssignments] = useState<Record<string, Record<number, number>>>(
    getInitialAssignments(orderItems),
  );

  useEffect(() => {
    if (!visible) return;
    setCurrentStep(1);
    setCurrentAccountIndex(0);
    setIsPaymentMenuOpen(false);
    setAccounts([{ id: 1, name: 'Cuenta 1', paymentMethod: 'cash', amountReceived: '' }]);
    setItemAssignments(getInitialAssignments(orderItems));
  }, [visible, orderItems]);

  useEffect(() => {
    setCurrentAccountIndex((prev) => Math.min(prev, Math.max(0, accounts.length - 1)));
  }, [accounts.length]);

  useEffect(() => {
    setIsPaymentMenuOpen(false);
  }, [currentStep, currentAccountIndex]);

  const addAccount = () => {
    if (accounts.length >= MAX_SUB_ACCOUNTS) return;
    const nextId = Math.max(...accounts.map((account) => account.id), 0) + 1;
    setAccounts((prev) => [
      ...prev,
      { id: nextId, name: `Cuenta ${nextId}`, paymentMethod: 'cash', amountReceived: '' },
    ]);
  };

  const removeAccount = (accountId: number) => {
    if (accounts.length <= 1) return;
    const remaining = accounts.filter((account) => account.id !== accountId);
    const reassignTo = remaining[0]?.id ?? 1;
    setAccounts(remaining);

    setItemAssignments((prev) => {
      const next: Record<string, Record<number, number>> = { ...prev };
      Object.keys(next).forEach((itemId) => {
        const byAccount = { ...(next[itemId] || {}) };
        const qtyToReassign = Number(byAccount[accountId] || 0);
        delete byAccount[accountId];
        byAccount[reassignTo] = Number(byAccount[reassignTo] || 0) + qtyToReassign;
        next[itemId] = byAccount;
      });
      return next;
    });
  };

  const getItemExpectedQuantity = (itemId: string) => {
    const sourceItem = orderItems.find((row) => row.id === itemId);
    return Math.max(0, Math.floor(Number(sourceItem?.quantity || 0)));
  };

  const adjustItemQuantityForAccount = (itemId: string, accountId: number, delta: number) => {
    setItemAssignments((prev) => {
      const byAccount = { ...(prev[itemId] || {}) };
      const currentQty = Math.max(0, Math.floor(Number(byAccount[accountId] || 0)));
      const expected = getItemExpectedQuantity(itemId);
      const assignedOtherAccounts = Object.entries(byAccount).reduce((sum, [key, value]) => {
        if (Number(key) === accountId) return sum;
        return sum + Math.max(0, Math.floor(Number(value || 0)));
      }, 0);
      const maxAllowedForAccount = Math.max(0, expected - assignedOtherAccounts);
      const nextQty = Math.max(0, Math.min(currentQty + delta, maxAllowedForAccount));

      if (nextQty <= 0) {
        delete byAccount[accountId];
      } else {
        byAccount[accountId] = nextQty;
      }

      return { ...prev, [itemId]: byAccount };
    });
  };

  const subAccounts = useMemo(() => {
    return accounts.map((account) => {
      const items: SplitSubAccount['items'] = [];
      orderItems.forEach((item) => {
        const byAccount = itemAssignments[item.id] || {};
        const qty = Number(byAccount[account.id] || 0);
        if (qty <= 0) return;
        items.push({
          product_id: item.product_id,
          combo_id: item.combo_id,
          quantity: qty,
          price: Number(item.price || 0),
          unit_price: Number(item.price || 0),
        });
      });

      const total = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
      const roundedTotal = Math.round(total);
      const cashInput = account.amountReceived === '' ? String(roundedTotal) : account.amountReceived;
      const cashInfo = account.paymentMethod === 'cash'
        ? calculateCashChange(roundedTotal, cashInput)
        : { isValid: true, change: 0, breakdown: [], paid: null as number | null };

      return {
        ...account,
        items,
        total: roundedTotal,
        amountReceivedResolved: account.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.paid : null,
        changeAmount: account.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.change : 0,
        changeBreakdown: account.paymentMethod === 'cash' && cashInfo.isValid ? cashInfo.breakdown : [],
        cashInfo,
      };
    });
  }, [accounts, itemAssignments, orderItems]);

  const validationErrors = useMemo(() => {
    return orderItems
      .map((item) => {
        const expected = Number(item.quantity || 0);
        const assigned = Object.values(itemAssignments[item.id] || {}).reduce((sum, value) => sum + Number(value || 0), 0);
        if (assigned !== expected) {
          return { itemId: item.id, expected, assigned };
        }
        return null;
      })
      .filter(Boolean) as Array<{ itemId: string; expected: number; assigned: number }>;
  }, [itemAssignments, orderItems]);

  const hasCashValidationErrors = useMemo(() => {
    return subAccounts.some((sub) => sub.paymentMethod === 'cash' && sub.items.length > 0 && !sub.cashInfo.isValid);
  }, [subAccounts]);

  const canConfirm = useMemo(() => {
    return subAccounts.some((sub) => sub.items.length > 0)
      && validationErrors.length === 0
      && !hasCashValidationErrors;
  }, [subAccounts, validationErrors.length, hasCashValidationErrors]);

  const currentAccount = useMemo(
    () => subAccounts[currentAccountIndex] || subAccounts[0] || null,
    [currentAccountIndex, subAccounts],
  );
  const isLastAccountStep = currentAccountIndex >= accounts.length - 1;
  const isCurrentCashInvalid = Boolean(
    currentAccount
    && currentAccount.paymentMethod === 'cash'
    && currentAccount.items.length > 0
    && !currentAccount.cashInfo.isValid,
  );
  const hasCurrentAccountItems = (currentAccount?.items.length || 0) > 0;

  const handleConfirm = () => {
    if (!canConfirm || submitting) return;

    const validSubAccounts = subAccounts
      .filter((sub) => sub.items.length > 0)
      .map((sub) => ({
        name: sub.name,
        paymentMethod: sub.paymentMethod,
        items: sub.items,
        total: sub.total,
        amountReceived: sub.paymentMethod === 'cash' ? sub.amountReceivedResolved : null,
        changeBreakdown: sub.paymentMethod === 'cash' ? sub.changeBreakdown : [],
      }));

    onConfirm({ subAccounts: validSubAccounts });
  };

  const handlePrimaryAction = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
      setCurrentAccountIndex(0);
      return;
    }

    if (!currentAccount || isCurrentCashInvalid || !hasCurrentAccountItems || submitting) return;

    if (!isLastAccountStep) {
      setCurrentAccountIndex((prev) => Math.min(prev + 1, accounts.length - 1));
      return;
    }

    handleConfirm();
  };

  const handleSecondaryAction = () => {
    if (currentStep === 1) {
      onBack();
      return;
    }

    if (currentAccountIndex > 0) {
      setCurrentAccountIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    setCurrentStep(1);
  };

  const primaryButtonLabel = currentStep === 1
    ? 'Iniciar división'
    : (isLastAccountStep ? (submitting ? 'Procesando...' : 'Terminar venta') : 'Siguiente cuenta');
  const secondaryButtonLabel = currentStep === 1
    ? 'Volver'
    : 'Atrás';
  const isPrimaryDisabled = currentStep === 1
    ? false
    : (submitting || !currentAccount || isCurrentCashInvalid || !hasCurrentAccountItems || (isLastAccountStep && !canConfirm));

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={14}
      modalAnimationType="fade"
      sheetStyle={styles.modalSheet}
      contentContainerStyle={styles.modalContent}
      contentStyle={styles.modalScroll}
      bodyFlex
      headerSlot={(
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderIcon}>
            <Ionicons name="receipt-outline" size={20} color="#4F46E5" />
          </View>
          <View style={styles.modalHeaderTextWrap}>
            <Text style={styles.modalHeaderTitle}>Dividir cuenta</Text>
            <Text style={styles.modalHeaderSubtitle}>Distribuye productos por cuenta y confirma.</Text>
          </View>
        </View>
      )}
      onClose={onClose}
      footerStyle={styles.modalFooter}
      footer={(
        <View style={styles.footerRow}>
          <Pressable style={styles.secondaryButton} onPress={handleSecondaryAction} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>{secondaryButtonLabel}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButtonWrap, isPrimaryDisabled && styles.actionButtonDisabled]}
            onPress={handlePrimaryAction}
            disabled={isPrimaryDisabled}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}
            >
              <Ionicons
                name={currentStep === 2 && isLastAccountStep ? 'checkmark-circle-outline' : 'arrow-forward-circle-outline'}
                size={18}
                color="#E9D5FF"
              />
              <Text style={styles.actionButtonText}>{primaryButtonLabel}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    >
      {currentStep === 1 ? (
        <>
          <View style={styles.stepperRow}>
            {[
              { id: 1 as const, label: 'Cuentas' },
              { id: 2 as const, label: 'División' },
            ].map((step) => {
              const active = currentStep === step.id;
              const complete = currentStep > step.id;
              return (
                <View key={step.id} style={styles.stepperItem}>
                  <View style={[styles.stepperDot, active && styles.stepperDotActive, complete && styles.stepperDotComplete]}>
                    <Text style={[styles.stepperDotText, (active || complete) && styles.stepperDotTextActive]}>{step.id}</Text>
                  </View>
                  <Text style={[styles.stepperLabel, active && styles.stepperLabelActive]}>{step.label}</Text>
                </View>
              );
            })}
          </View>

        </>
      ) : null}

      {currentStep === 1 ? (
        <>
          <Text style={styles.sectionTitle}>1. Configura cuentas</Text>
          <Text style={styles.helper}>
            Define cuántas cuentas pagarán esta orden.
          </Text>
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>Número de cuentas</Text>
            <View style={styles.counterRow}>
              <Pressable
                style={[styles.counterButton, accounts.length <= 1 && styles.actionButtonDisabled]}
                onPress={() => removeAccount(accounts[accounts.length - 1]?.id ?? 1)}
                disabled={accounts.length <= 1}
              >
                <Ionicons name="remove" size={18} color={STOCKY_COLORS.primary900} />
              </Pressable>
              <Text style={styles.counterValue}>{accounts.length}</Text>
              <Pressable
                style={[styles.counterButton, accounts.length >= MAX_SUB_ACCOUNTS && styles.actionButtonDisabled]}
                onPress={addAccount}
                disabled={accounts.length >= MAX_SUB_ACCOUNTS}
              >
                <Ionicons name="add" size={18} color={STOCKY_COLORS.primary900} />
              </Pressable>
            </View>
            <Text style={styles.counterHint}>Máximo {MAX_SUB_ACCOUNTS} cuentas</Text>
          </View>
          <View style={styles.accountsPreview}>
            {accounts.map((account, index) => (
              <View key={account.id} style={styles.accountsPreviewChip}>
                <Text style={styles.accountsPreviewText}>{`Cuenta ${index + 1}`}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {currentStep === 2 ? (
        <>
          <Text style={styles.sectionTitle}>{`Cuenta ${currentAccountIndex + 1}/${accounts.length}`}</Text>
          {currentAccount ? (
            <>
              <Text style={styles.fieldLabel}>Método de pago</Text>
              <View style={styles.dropdownWrap}>
                <Pressable
                  style={styles.dropdownTrigger}
                  onPress={() => setIsPaymentMenuOpen((prev) => !prev)}
                >
                  <View style={styles.dropdownTriggerLeft}>
                    {isBankPaymentMethod(currentAccount.paymentMethod) ? (
                      <Image source={getBankLogoSource(currentAccount.paymentMethod)!} style={styles.paymentLogo} resizeMode="contain" />
                    ) : (
                      <Ionicons
                        name={getPaymentOptionIcon(currentAccount.paymentMethod)}
                        size={16}
                        color={STOCKY_COLORS.textSecondary}
                      />
                    )}
                    <Text style={styles.dropdownTriggerText}>{getPaymentOptionLabel(currentAccount.paymentMethod)}</Text>
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
                            setAccounts((prev) =>
                              prev.map((row) => (row.id === currentAccount.id ? { ...row, paymentMethod: option.value } : row))
                            );
                            setIsPaymentMenuOpen(false);
                          }}
                          style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                        >
                          {isBankPaymentMethod(option.value) ? (
                            <Image source={getBankLogoSource(option.value)!} style={styles.paymentLogoSmall} resizeMode="contain" />
                          ) : (
                            <Ionicons
                              name={getPaymentOptionIcon(option.value)}
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
                    <Text style={styles.assignmentInfoTitle}>{getOrderItemName(item)}</Text>
                    <Text style={styles.assignmentInfoText}>Máximo disponible: {maxForSelected}</Text>
                  </View>
                  <View style={styles.assignmentControls}>
                    <Pressable
                      style={[styles.qtyStepButton, selectedQty <= 0 && styles.actionButtonDisabled]}
                      onPress={() => currentAccount && adjustItemQuantityForAccount(item.id, currentAccount.id, -1)}
                      disabled={!currentAccount || selectedQty <= 0}
                    >
                      <Text style={styles.qtyStepText}>-</Text>
                    </Pressable>
                    <View style={styles.qtyValueBadge}>
                      <Text style={styles.qtyValueText}>{selectedQty > 0 ? String(selectedQty) : ''}</Text>
                    </View>
                    <Pressable
                      style={[styles.qtyStepButton, selectedQty >= maxForSelected && styles.actionButtonDisabled]}
                      onPress={() => currentAccount && adjustItemQuantityForAccount(item.id, currentAccount.id, 1)}
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
      ) : null}
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  modalSheet: {
    borderRadius: 24,
    borderColor: '#E2E8F0',
    maxWidth: 460,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTextWrap: {
    flex: 1,
    gap: 1,
  },
  modalHeaderTitle: {
    color: '#0F172A',
    fontSize: 34,
    fontWeight: '700',
  },
  modalHeaderSubtitle: {
    color: '#64748B',
    fontSize: 19,
    fontWeight: '500',
  },
  helper: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: STOCKY_COLORS.textSecondary,
  },
  fieldLabel: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  dropdownWrap: {
    gap: 6,
  },
  dropdownTrigger: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  paymentLogo: {
    width: 22,
    height: 14,
  },
  paymentLogoSmall: {
    width: 20,
    height: 12,
  },
  dropdownTriggerText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '600',
  },
  dropdownMenu: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    overflow: 'hidden',
  },
  dropdownItem: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  dropdownItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  dropdownItemText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepperDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  stepperDotComplete: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  stepperDotText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  stepperDotTextActive: {
    color: '#4F46E5',
  },
  stepperLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  stepperLabelActive: {
    color: '#4F46E5',
  },
  sectionHeaderRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  accountSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountSelectorChip: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    minWidth: 110,
  },
  accountSelectorChipSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  accountSelectorTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  accountSelectorTitleSelected: {
    color: '#5B21B6',
  },
  accountSelectorUnits: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  accountSelectorUnitsSelected: {
    color: '#7C3AED',
  },
  accountSelectorTotal: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  accountSelectorTotalSelected: {
    color: '#6D28D9',
  },
  accountCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 12,
    gap: 10,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountTitleWrap: {
    flex: 1,
    gap: 2,
  },
  accountTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  accountMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  accountProgressText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '800',
  },
  subSectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  removeButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: STOCKY_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paymentOptionSelected: {
    backgroundColor: STOCKY_COLORS.primary700,
    borderColor: STOCKY_COLORS.primary700,
  },
  paymentOptionText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  paymentOptionTextSelected: {
    color: STOCKY_COLORS.white,
  },
  accountTotal: {
    color: STOCKY_COLORS.primary900,
    fontSize: 12,
    fontWeight: '800',
  },
  accountTotalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  accountBadge: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  accountBadgeLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  accountBadgeValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    minHeight: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.28)',
    backgroundColor: 'rgba(196, 181, 253, 0.2)',
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  quickActionText: {
    color: '#6D28D9',
    fontSize: 10,
    fontWeight: '700',
  },
  accountTotalDueRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  accountTotalDueLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  accountTotalDueValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  addAccountButton: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.accent500,
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 244, 246, 0.62)',
  },
  addAccountButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 11,
    fontWeight: '800',
  },
  counterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  counterLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },
  counterHint: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  accountsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountsPreviewChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  accountsPreviewText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 12,
    gap: 10,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(102, 165, 173, 0.25)',
    backgroundColor: 'rgba(232, 244, 246, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  assignmentInfo: {
    flex: 1,
    gap: 1,
    paddingRight: 8,
  },
  assignmentInfoTitle: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  assignmentInfoText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  assignmentControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyStepButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyStepText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 20,
    fontWeight: '700',
  },
  qtyValueBadge: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  qtyValueText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  validationBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.25)',
    backgroundColor: 'rgba(254, 226, 226, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validationError: {
    color: STOCKY_COLORS.errorText,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionButtonWrap: {
    flex: 1,
    borderRadius: STOCKY_RADIUS.md,
    overflow: 'hidden',
  },
  actionButton: {
    minHeight: 46,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: '#E9D5FF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D1D9E2',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  secondaryButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 16,
    fontWeight: '800',
  },
});
