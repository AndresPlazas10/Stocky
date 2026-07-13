import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import type { InventoryProductRecord } from '../../../services/inventoryService';

type Props = {
  visible: boolean;
  deleting: boolean;
  productTarget: InventoryProductRecord | null;
  deleteCheckResult: {
    has_sales: boolean;
    has_purchases: boolean;
    sales_count: number;
    purchases_count: number;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
};

export const DeactivateConfirmModal = memo(function DeactivateConfirmModal({
  visible,
  deleting,
  productTarget,
  deleteCheckResult,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const disableCancel = deleting;
  const disableConfirm = deleting;

  const getMessage = () => {
    if (!deleteCheckResult) return '';
    const name = productTarget?.name || t('inventarioSection.thisProduct');
    const { has_sales, has_purchases, sales_count, purchases_count } = deleteCheckResult;

    if (has_sales && has_purchases) {
      return `${name} ${t('inventarioSection.hasTransactions')}`;
    }
    if (has_sales) {
      return `${name} ${t('inventarioSection.hasSales')}`;
    }
    if (has_purchases) {
      return `${name} ${t('inventarioSection.hasPurchases')}`;
    }
    return `${name} ${t('inventarioSection.noTransactions')}`;
  };

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={70}
      hideCloseButton
      onClose={() => {
        if (disableCancel) return;
        onClose();
      }}
      sheetStyle={styles.sheet}
      contentContainerStyle={styles.content}
      footerStyle={styles.footer}
      headerSlot={
        <LinearGradient
          colors={['#EAB308', '#CA8A04']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="warning-outline" size={18} color="#FEF9C3" />
            </View>
            <Text style={styles.headerTitle}>{t('inventarioSection.deactivateProduct')}</Text>
          </View>
          <Pressable style={styles.headerClose} onPress={onClose} disabled={disableCancel}>
            <Ionicons name="close" size={19} color="#FEF9C3" />
          </Pressable>
        </LinearGradient>
      }
      footer={
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.cancelButton, disableCancel && styles.disabled]}
            onPress={onClose}
            disabled={disableCancel}
          >
            <Text style={styles.cancelText}>{t('buttons.cancel')}</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmWrap, disableConfirm && styles.disabled]}
            onPress={onConfirm}
            disabled={disableConfirm}
          >
            <LinearGradient
              colors={disableConfirm ? ['#9CA3AF', '#94A3B8'] : ['#EAB308', '#CA8A04']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButton}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="eye-off-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>
                {deleting ? t('inventarioSection.deactivating') : t('buttons.deactivate')}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <View style={styles.messageCard}>
        <Text style={styles.messageText}>{getMessage()}</Text>
        <Text style={styles.warningText}>{t('inventarioSection.canDeactivate')}</Text>
      </View>

      {productTarget ? (
        <View style={styles.itemCard}>
          <View style={styles.itemIcon}>
            <Ionicons name="cube-outline" size={18} color="#CA8A04" />
          </View>
          <View style={styles.itemTextWrap}>
            <Text style={styles.itemLabel}>{t('inventarioSection.selectedProduct')}</Text>
            <Text style={styles.itemValue} numberOfLines={2}>
              {productTarget.name}
            </Text>
          </View>
        </View>
      ) : null}
    </StockyModal>
  );
});

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
    color: '#FEF9C3',
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
    borderColor: '#FDE047',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  messageText: {
    color: '#713F12',
    fontSize: 13,
    fontWeight: '700',
  },
  warningText: {
    color: '#854D0E',
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
    backgroundColor: '#FEF9C3',
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
