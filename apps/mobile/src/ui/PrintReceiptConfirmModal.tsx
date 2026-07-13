import React from 'react';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StockyModal } from './StockyModal';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = PropsWithChildren<{
  visible: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  customerName?: string;
  onCustomerNameChange?: (name: string) => void;
}>;

export const PrintReceiptConfirmModal = React.memo(function PrintReceiptConfirmModal({
  visible,
  onConfirm,
  onCancel,
  isLoading = false,
  customerName: customerNameProp,
  onCustomerNameChange,
}: Props) {
  const { t } = useTranslation();
  const customerName = customerNameProp ?? t('printReceipt.defaultCustomer');
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      if (__DEV__) console.error('Error confirming print:', error);
    }
  };

  return (
    <StockyModal
      visible={visible}
      onClose={onCancel}
      title={t('printReceipt.title')}
      layout="centered"
      centeredOffsetY={-50}
      footer={
        <View style={styles.footer}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>{t('printReceipt.no')}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.confirmButton, isLoading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={STOCKY_COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons
                  name="print-outline"
                  size={18}
                  color={STOCKY_COLORS.white}
                  style={styles.buttonIcon}
                />
                <Text style={styles.confirmButtonText}>{t('printReceipt.yes')}</Text>
              </>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={styles.headerIcon}>
        <View style={styles.iconOuterRing}>
          <View style={styles.iconContainer}>
            <Ionicons name="receipt-outline" size={34} color="#7C3AED" />
          </View>
        </View>
      </View>
      <Text style={styles.title}>{t('printReceipt.confirmMessage')}</Text>
      <Text style={styles.description}>{t('printReceipt.printerNote')}</Text>
      <Text style={styles.fieldLabel}>{t('printReceipt.customerLabel')}</Text>
      <TextInput
        style={styles.customerInput}
        value={customerName}
        onChangeText={onCustomerNameChange}
        placeholder={t('printReceipt.defaultCustomer')}
        placeholderTextColor={STOCKY_COLORS.textMuted}
        editable={!isLoading}
      />
    </StockyModal>
  );
});

const styles = StyleSheet.create({
  headerIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconOuterRing: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: STOCKY_COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: STOCKY_COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: STOCKY_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: STOCKY_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButton: {
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
  },
  confirmButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textMuted,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.white,
  },
  buttonIcon: {
    marginRight: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: STOCKY_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 24,
  },
  customerInput: {
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: STOCKY_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textPrimary,
    backgroundColor: '#F5F3FF',
  },
});
