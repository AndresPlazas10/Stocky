import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';
import { StockyModal } from './StockyModal';

type Props = {
  visible: boolean;
  title: string;
  itemLabel?: string | null;
  message: string;
  warning?: string | null;
  loading?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmText?: string;
  loadingText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StockyDeleteConfirmModal({
  visible,
  title,
  itemLabel,
  message,
  warning,
  loading = false,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmText = 'Eliminar',
  loadingText = 'Eliminando...',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: Props) {
  const disableCancel = loading || cancelDisabled;
  const disableConfirm = loading || confirmDisabled;

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={70}
      modalAnimationType="fade"
      onClose={() => {
        if (disableCancel) return;
        onCancel();
      }}
      sheetStyle={styles.sheet}
      contentContainerStyle={styles.content}
      footerStyle={styles.footer}
      headerSlot={(
        <LinearGradient
          colors={['#DC2626', '#B91C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="warning-outline" size={18} color="#FEE2E2" />
            </View>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
          <Pressable style={styles.headerClose} onPress={onCancel} disabled={disableCancel}>
            <Ionicons name="close" size={19} color="#FEE2E2" />
          </Pressable>
        </LinearGradient>
      )}
      footer={(
        <View style={styles.actionsRow}>
          <Pressable style={[styles.cancelButton, disableCancel && styles.disabled]} onPress={onCancel} disabled={disableCancel}>
            <Text style={styles.cancelText}>{cancelText}</Text>
          </Pressable>
          <Pressable style={[styles.confirmWrap, disableConfirm && styles.disabled]} onPress={onConfirm} disabled={disableConfirm}>
            <LinearGradient
              colors={disableConfirm ? ['#9CA3AF', '#94A3B8'] : ['#DC2626', '#B91C1C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>{loading ? loadingText : confirmText}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.messageCard}>
        <Text style={styles.messageText}>{message}</Text>
        {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
      </View>

      {itemLabel ? (
        <View style={styles.itemCard}>
          <View style={styles.itemIcon}>
            <Ionicons name="cube-outline" size={18} color="#B91C1C" />
          </View>
          <View style={styles.itemTextWrap}>
            <Text style={styles.itemLabel}>Elemento seleccionado</Text>
            <Text style={styles.itemValue} numberOfLines={2}>{itemLabel}</Text>
          </View>
        </View>
      ) : null}
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  content: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FEE2E2',
    fontSize: 17,
    fontWeight: '800',
  },
  headerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  messageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  messageText: {
    color: '#7F1D1D',
    fontSize: 13,
    fontWeight: '700',
  },
  warningText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '600',
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  itemValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  cancelText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmWrap: {
    flex: 1,
  },
  confirmButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.68,
  },
});
