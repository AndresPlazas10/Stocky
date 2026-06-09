import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { getPaymentMethodLabel, getPaymentMethodIcon } from '../../../utils/paymentMethods';
import { getBankLogoSource, isBankPaymentMethod } from '../../../utils/paymentMethodBranding';
import { PAYMENT_METHOD_OPTIONS, buildCashBreakdown } from '../utils/mesaHelpers';
import type { PaymentMethod } from '../../../services/mesaCheckoutService';

interface PaymentModalProps {
  visible: boolean;
  isClosing: boolean;
  paymentMethod: PaymentMethod;
  amountReceived: string;
  orderTotal: number;
  cashChangeData: { isValid: boolean; reason: string | null; change: number; paid: number } | null;
  showMenu: boolean;
  onClose: () => void;
  onToggleMenu: () => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onAmountReceivedChange: (value: string) => void;
  onConfirm: () => void;
}

export function PaymentModal({
  visible,
  isClosing,
  paymentMethod,
  amountReceived,
  orderTotal,
  cashChangeData,
  showMenu,
  onClose,
  onToggleMenu,
  onPaymentMethodChange,
  onAmountReceivedChange,
  onConfirm,
}: PaymentModalProps) {
  const isValid = paymentMethod !== 'cash' || cashChangeData?.isValid;

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={8}
      modalAnimationType="fade"
      sheetStyle={styles.sheet}
      headerSlot={(
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerBadge}>
              <Ionicons name="card-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Confirmar pago</Text>
              <Text style={styles.headerSubtitle}>Revisa el cierre antes de confirmar la venta.</Text>
            </View>
          </View>
        </View>
      )}
      contentContainerStyle={styles.content}
      onClose={onClose}
      footerStyle={styles.footer}
      footer={(
        <View style={styles.footerRow}>
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isClosing}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[
              styles.confirmButtonWrap,
              (isClosing || !isValid) && styles.disabled,
            ]}
            onPress={onConfirm}
            disabled={isClosing || !isValid}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButton}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#C4B5FD" />
              <Text style={styles.confirmText}>{isClosing ? 'Procesando...' : 'Confirmar Venta'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    >
      <LinearGradient
        colors={['#F5F3FF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.summaryCard}
      >
        <Text style={styles.summaryTitle}>TOTAL A PAGAR</Text>
        <StockyMoneyText value={orderTotal} style={styles.summaryTotal} />
        <View style={styles.summaryMetaRow}>
          <View style={styles.summaryMetaBlock}>
            <Text style={styles.summaryMetaLabel}>Método</Text>
            <Text style={styles.summaryMetaValue}>{getPaymentMethodLabel(paymentMethod)}</Text>
          </View>
          <View style={[styles.summaryMetaBlock, styles.summaryMetaBlockRight]}>
            <Text style={styles.summaryMetaLabel}>Cambio</Text>
            <StockyMoneyText
              value={paymentMethod === 'cash' && cashChangeData?.isValid ? Number(cashChangeData.change || 0) : 0}
              style={styles.summaryMetaValue}
            />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Método de pago *</Text>
        <Pressable
          style={styles.field}
          onPress={onToggleMenu}
          disabled={isClosing}
        >
          <View style={styles.fieldLeft}>
            {isBankPaymentMethod(paymentMethod) ? (
              <Image source={getBankLogoSource(paymentMethod)!} style={styles.methodLogo} resizeMode="contain" />
            ) : (
              <Ionicons name={getPaymentMethodIcon(paymentMethod)} size={20} color="#111827" />
            )}
            <Text style={styles.fieldValue}>{getPaymentMethodLabel(paymentMethod)}</Text>
          </View>
          <Ionicons name={showMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#374151" />
        </Pressable>
        {showMenu ? (
          <View style={styles.methodMenu}>
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const selected = option.value === paymentMethod;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.menuItem, selected && styles.menuItemSelected]}
                  onPress={() => {
                    onPaymentMethodChange(option.value);
                    if (option.value === 'cash' && String(amountReceived || '').trim() === '') {
                      onAmountReceivedChange(String(Math.round(orderTotal || 0)));
                    }
                  }}
                >
                  <View style={styles.fieldLeft}>
                    {isBankPaymentMethod(option.value) ? (
                      <Image source={getBankLogoSource(option.value)!} style={styles.methodLogoSmall} resizeMode="contain" />
                    ) : (
                      <Ionicons name={getPaymentMethodIcon(option.value)} size={18} color={selected ? '#4F46E5' : '#111827'} />
                    )}
                    <Text style={[styles.menuText, selected && styles.menuTextSelected]}>{option.label}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark" size={18} color="#4F46E5" /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Cliente (opcional)</Text>
        <View style={styles.field}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldValue}>Venta general</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#6B7280" />
        </View>

        {paymentMethod === 'cash' ? (
          <>
            <Text style={styles.fieldLabel}>Monto recibido</Text>
            <TextInput
              value={amountReceived}
              onChangeText={onAmountReceivedChange}
              placeholder="Ej: 128000"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              keyboardType="numeric"
            />
          </>
        ) : null}
      </View>

      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>DESGLOSE DEL CAMBIO</Text>
        {paymentMethod !== 'cash' ? (
          <Text style={styles.breakdownText}>No aplica para este método de pago.</Text>
        ) : !cashChangeData?.isValid ? (
          <Text style={[styles.breakdownText, styles.breakdownError]}>
            Monto recibido inválido o insuficiente.
          </Text>
        ) : Number(cashChangeData.change || 0) <= 0 ? (
          <Text style={styles.breakdownText}>Sin cambio para devolver.</Text>
        ) : (
          <View style={styles.breakdownList}>
            {buildCashBreakdown(Number(cashChangeData.change || 0)).map((row) => (
              <View key={`${row.denomination}-${row.count}`} style={styles.breakdownRow}>
                <Text style={styles.breakdownText}>{row.count} x</Text>
                <StockyMoneyText value={row.denomination} style={styles.breakdownText} />
              </View>
            ))}
          </View>
        )}
      </View>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 26,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  confirmButtonWrap: {
    flex: 1,
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.7,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  summaryTotal: {
    fontSize: 36,
    fontWeight: '900',
  },
  summaryMetaRow: {
    flexDirection: 'row',
    marginTop: 10,
    width: '100%',
  },
  summaryMetaBlock: {
    flex: 1,
    alignItems: 'center',
  },
  summaryMetaBlockRight: {
    borderLeftWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  summaryMetaValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    minHeight: 48,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  methodLogo: {
    width: 22,
    height: 22,
  },
  methodLogoSmall: {
    width: 20,
    height: 20,
  },
  methodMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemSelected: {
    backgroundColor: '#F5F3FF',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  menuTextSelected: {
    color: '#4F46E5',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 6,
  },
  breakdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  breakdownError: {
    color: '#DC2626',
  },
  breakdownList: {
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});
