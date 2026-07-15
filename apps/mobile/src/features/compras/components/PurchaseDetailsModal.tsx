import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { formatDateTime } from '../../../utils/dateHelpers';
import { useBusinessConfig } from '../../../contexts/BusinessConfigContext';
import { getPaymentMethodLabel, getPaymentMethodTheme } from '../../../utils/paymentMethods';
import type { CompraDetailRecord, CompraRecord } from '../../../services/comprasService';
import { comprasStyles as s } from '../comprasStyles';

type PurchaseDetailsModalProps = {
  visible: boolean;
  selectedPurchase: CompraRecord | null;
  selectedPurchaseDetails: CompraDetailRecord[];
  loadingPurchaseDetails: boolean;
  supplierLabel: string;
  onClose: () => void;
};

export const PurchaseDetailsModal = React.memo(function PurchaseDetailsModal({
  visible,
  selectedPurchase,
  selectedPurchaseDetails,
  loadingPurchaseDetails,
  supplierLabel,
  onClose,
}: PurchaseDetailsModalProps) {
  const { t } = useTranslation();
  const { timezone } = useBusinessConfig();
  const selectedPurchaseItemsCount = useMemo(
    () =>
      selectedPurchaseDetails.reduce(
        (sum, detail) => sum + Math.max(0, Number(detail.quantity || 0)),
        0,
      ),
    [selectedPurchaseDetails],
  );
  const selectedPurchasePaymentTheme = selectedPurchase
    ? getPaymentMethodTheme(selectedPurchase.payment_method)
    : null;

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={12}
      bodyFlex
      sheetStyle={s.purchaseDetailsModalSheet}
      contentContainerStyle={s.purchaseDetailsContentContainer}
      footerStyle={s.purchaseDetailsFooter}
      onClose={onClose}
      hideCloseButton
      headerSlot={
        <LinearGradient
          colors={['#4338CA', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.purchaseDetailsHeader}
        >
          <View style={s.purchaseDetailsHeaderLeft}>
            <View style={s.purchaseDetailsHeaderIconWrap}>
              <Ionicons name="bag-handle-outline" size={19} color="#EDE9FE" />
            </View>
            <View style={s.purchaseDetailsHeaderTextWrap}>
              <Text style={s.purchaseDetailsHeaderTitle}>{t('comprasSection.purchaseDetail')}</Text>
              <Text style={s.purchaseDetailsHeaderSubtitle}>
                {selectedPurchase
                  ? `ID ${selectedPurchase.id.slice(0, 8).toUpperCase()}`
                  : t('comprasSection.noReference')}
              </Text>
            </View>
          </View>
          <Pressable style={s.purchaseDetailsHeaderClose} onPress={onClose}>
            <Ionicons name="close" size={20} color="#EDE9FE" />
          </Pressable>
        </LinearGradient>
      }
      footer={
        <View style={s.modalFooter}>
          <Pressable style={s.secondaryButton} onPress={onClose}>
            <Text style={s.secondaryButtonText}>{t('buttons.close')}</Text>
          </Pressable>
        </View>
      }
    >
      {selectedPurchase ? (
        <View style={s.purchaseDetailsHeroCard}>
          <View style={s.purchaseDetailsHeroTopRow}>
            <View style={s.purchaseDetailsHeroTotalWrap}>
              <Text style={s.purchaseDetailsHeroLabel}>{t('comprasSection.totalLabel')}</Text>
              <StockyMoneyText value={selectedPurchase.total} style={s.purchaseDetailsHeroTotal} />
            </View>
            <View
              style={[
                s.purchaseDetailsHeroMethodBadge,
                { backgroundColor: selectedPurchasePaymentTheme?.backgroundColor || '#DCFCE7' },
              ]}
            >
              <Ionicons
                name={selectedPurchasePaymentTheme?.icon || 'cash-outline'}
                size={14}
                color={selectedPurchasePaymentTheme?.iconColor || '#16A34A'}
              />
              <Text
                style={[
                  s.purchaseDetailsHeroMethodBadgeText,
                  { color: selectedPurchasePaymentTheme?.textColor || '#166534' },
                ]}
              >
                {getPaymentMethodLabel(selectedPurchase.payment_method)}
              </Text>
            </View>
          </View>

          <View style={s.purchaseDetailsHeroMetaGrid}>
            <View style={s.purchaseDetailsHeroMetaItem}>
              <Ionicons name="business-outline" size={14} color="#64748B" />
              <Text style={s.purchaseDetailsHeroMetaText}>{supplierLabel}</Text>
            </View>
            <View style={s.purchaseDetailsHeroMetaItem}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={s.purchaseDetailsHeroMetaText}>
                {formatDateTime(selectedPurchase.created_at, { timezone })}
              </Text>
            </View>
            <View style={s.purchaseDetailsHeroMetaItem}>
              <Ionicons name="basket-outline" size={14} color="#64748B" />
              <Text style={s.purchaseDetailsHeroMetaText}>
                {selectedPurchaseItemsCount}{' '}
                {selectedPurchaseItemsCount === 1
                  ? t('ventasSection.unit')
                  : t('ventasSection.units')}
              </Text>
            </View>
          </View>

          {selectedPurchase.notes ? (
            <View style={s.purchaseDetailsNoteCard}>
              <Text style={s.purchaseDetailsNoteLabel}>{t('comprasSection.notes')}</Text>
              <Text style={s.purchaseDetailsNoteText}>{selectedPurchase.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={s.purchaseDetailsItemsSectionHeader}>
        <Text style={s.purchaseDetailsItemsSectionTitle}>
          {t('comprasSection.productsPurchased')}
        </Text>
        <View style={s.purchaseDetailsItemsCountBadge}>
          <Text style={s.purchaseDetailsItemsCountText}>
            {selectedPurchaseDetails.length}{' '}
            {selectedPurchaseDetails.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
      {loadingPurchaseDetails ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {!loadingPurchaseDetails && selectedPurchaseDetails.length === 0 ? (
        <Text style={s.emptyTextLarge}>{t('comprasSection.noDetails')}</Text>
      ) : null}
      {!loadingPurchaseDetails && selectedPurchaseDetails.length > 0 ? (
        <View style={s.purchaseDetailsListCard}>
          {selectedPurchaseDetails.map((detail, index) => (
            <View
              key={detail.id}
              style={[
                s.purchaseDetailsListRow,
                index < selectedPurchaseDetails.length - 1 && s.purchaseDetailsListRowDivider,
              ]}
            >
              <View style={s.purchaseDetailsListRowLeft}>
                <View style={s.purchaseDetailsQtyBadge}>
                  <Text style={s.purchaseDetailsQtyBadgeText}>{detail.quantity}</Text>
                </View>
                <View style={s.purchaseDetailsListMain}>
                  <Text style={s.purchaseDetailsListName}>
                    {detail.product?.name || t('comprasSection.product')}
                  </Text>
                  <Text style={s.purchaseDetailsListMeta}>
                    <StockyMoneyText value={detail.unit_cost} style={s.purchaseDetailsListMeta} />{' '}
                    {t('ventasSection.perUnit')}
                  </Text>
                </View>
              </View>
              <StockyMoneyText value={detail.subtotal} style={s.purchaseDetailsListSubtotal} />
            </View>
          ))}

          <View style={s.purchaseDetailsListFooter}>
            <Text style={s.purchaseDetailsListFooterLabel}>{t('comprasSection.finalTotal')}</Text>
            <StockyMoneyText
              value={selectedPurchase?.total || 0}
              style={s.purchaseDetailsListFooterValue}
            />
          </View>
        </View>
      ) : null}
    </StockyModal>
  );
});
