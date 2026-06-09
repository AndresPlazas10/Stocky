import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { formatDateTime } from '../../../utils/dateHelpers';
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

export function PurchaseDetailsModal({
  visible,
  selectedPurchase,
  selectedPurchaseDetails,
  loadingPurchaseDetails,
  supplierLabel,
  onClose,
}: PurchaseDetailsModalProps) {
  const selectedPurchaseItemsCount = selectedPurchaseDetails.reduce(
    (sum, detail) => sum + Math.max(0, Number(detail.quantity || 0)),
    0,
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
      modalAnimationType="fade"
      bodyFlex
      sheetStyle={s.purchaseDetailsModalSheet}
      contentContainerStyle={s.purchaseDetailsContentContainer}
      footerStyle={s.purchaseDetailsFooter}
      onClose={onClose}
      hideCloseButton
      headerSlot={(
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
              <Text style={s.purchaseDetailsHeaderTitle}>Detalle de compra</Text>
              <Text style={s.purchaseDetailsHeaderSubtitle}>
                {selectedPurchase ? `ID ${selectedPurchase.id.slice(0, 8).toUpperCase()}` : 'Sin referencia'}
              </Text>
            </View>
          </View>
          <Pressable style={s.purchaseDetailsHeaderClose} onPress={onClose}>
            <Ionicons name="close" size={20} color="#EDE9FE" />
          </Pressable>
        </LinearGradient>
      )}
      footer={(
        <View style={s.modalFooter}>
          <Pressable style={s.secondaryButton} onPress={onClose}>
            <Text style={s.secondaryButtonText}>Cerrar</Text>
          </Pressable>
        </View>
      )}
    >
      {selectedPurchase ? (
        <View style={s.purchaseDetailsHeroCard}>
          <View style={s.purchaseDetailsHeroTopRow}>
            <View style={s.purchaseDetailsHeroTotalWrap}>
              <Text style={s.purchaseDetailsHeroLabel}>Total de la compra</Text>
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
              <Text style={s.purchaseDetailsHeroMetaText}>{formatDateTime(selectedPurchase.created_at)}</Text>
            </View>
            <View style={s.purchaseDetailsHeroMetaItem}>
              <Ionicons name="basket-outline" size={14} color="#64748B" />
              <Text style={s.purchaseDetailsHeroMetaText}>
                {selectedPurchaseItemsCount} {selectedPurchaseItemsCount === 1 ? 'unidad' : 'unidades'}
              </Text>
            </View>
          </View>

          {selectedPurchase.notes ? (
            <View style={s.purchaseDetailsNoteCard}>
              <Text style={s.purchaseDetailsNoteLabel}>Notas</Text>
              <Text style={s.purchaseDetailsNoteText}>{selectedPurchase.notes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={s.purchaseDetailsItemsSectionHeader}>
        <Text style={s.purchaseDetailsItemsSectionTitle}>Productos comprados</Text>
        <View style={s.purchaseDetailsItemsCountBadge}>
          <Text style={s.purchaseDetailsItemsCountText}>
            {selectedPurchaseDetails.length} {selectedPurchaseDetails.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
      {loadingPurchaseDetails ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {!loadingPurchaseDetails && selectedPurchaseDetails.length === 0 ? (
        <Text style={s.emptyTextLarge}>No hay detalles para esta compra.</Text>
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
                  <Text style={s.purchaseDetailsListName}>{detail.product?.name || 'Producto'}</Text>
                  <Text style={s.purchaseDetailsListMeta}>
                    <StockyMoneyText value={detail.unit_cost} style={s.purchaseDetailsListMeta} /> por unidad
                  </Text>
                </View>
              </View>
              <StockyMoneyText value={detail.subtotal} style={s.purchaseDetailsListSubtotal} />
            </View>
          ))}

          <View style={s.purchaseDetailsListFooter}>
            <Text style={s.purchaseDetailsListFooterLabel}>Total final</Text>
            <StockyMoneyText value={selectedPurchase?.total || 0} style={s.purchaseDetailsListFooterValue} />
          </View>
        </View>
      ) : null}
    </StockyModal>
  );
}
