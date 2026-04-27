import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StockyModal } from './StockyModal';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = PropsWithChildren<{
  visible: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}>;

export function PrintReceiptConfirmModal({
  visible,
  onConfirm,
  onCancel,
  isLoading = false,
}: Props) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error confirming print:', error);
    }
  };

  return (
    <StockyModal
      visible={visible}
      onClose={onCancel}
      title="Imprimir comprobante"
      layout="centered"
      centeredOffsetY={-50}
      footer={
        <View style={styles.footer}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>No</Text>
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
                <MaterialCommunityIcons
                  name="printer"
                  size={18}
                  color={STOCKY_COLORS.white}
                  style={styles.buttonIcon}
                />
                <Text style={styles.confirmButtonText}>Sí, imprimir</Text>
              </>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={styles.headerIcon}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="printer"
            size={32}
            color={STOCKY_COLORS.primary700}
          />
        </View>
      </View>
      <Text style={styles.title}>¿Deseas imprimir el comprobante de venta?</Text>
      <Text style={styles.description}>
        Se enviará el comprobante a la impresora térmica configurada.
      </Text>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: STOCKY_COLORS.backgroundSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: STOCKY_COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: STOCKY_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: STOCKY_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
  },
  confirmButton: {
    backgroundColor: STOCKY_COLORS.primary700,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.textSecondary,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: STOCKY_COLORS.white,
  },
  buttonIcon: {
    marginRight: 4,
  },
});

