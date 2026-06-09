import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { formatDateTime } from '../../../utils/dateHelpers';
import { getBankLogoSource, isBankPaymentMethod } from '../../../utils/paymentMethodBranding';
import { getPaymentMethodLabel, getPaymentMethodTheme } from '../../../utils/paymentMethods';
import {
  getOrderItemName,
  type MesaOrderItem,
} from '../../../services/mesaOrderService';
import type { VentaDetailRecord, VentaRecord } from '../../../services/ventasService';
import { ventasStyles as s } from '../ventasStyles';

type SaleDetailsModalProps = {
  visible: boolean;
  selectedVenta: VentaRecord | null;
  selectedVentaDetails: VentaDetailRecord[];
  loadingVentaDetails: boolean;
  ventaDetailsError: string | null;
  onClose: () => void;
};

export function SaleDetailsModal({
  visible,
  selectedVenta,
  selectedVentaDetails,
  loadingVentaDetails,
  ventaDetailsError,
  onClose,
}: SaleDetailsModalProps) {
  const selectedVentaItemsCount = selectedVentaDetails.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
    0,
  );
  const selectedVentaPaymentTheme = selectedVenta
    ? getPaymentMethodTheme(selectedVenta.payment_method)
    : null;

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={12}
      modalAnimationType="fade"
      bodyFlex
      sheetStyle={s.saleDetailsModalSheet}
      contentContainerStyle={s.saleDetailsContentContainer}
      onClose={onClose}
      hideCloseButton
      headerSlot={(
        <LinearGradient
          colors={['#4338CA', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.saleDetailsHeader}
        >
          <View style={s.saleDetailsHeaderLeft}>
            <View style={s.saleDetailsHeaderIconWrap}>
              <Ionicons name="receipt-outline" size={19} color="#EDE9FE" />
            </View>
            <View style={s.saleDetailsHeaderTextWrap}>
              <Text style={s.saleDetailsHeaderTitle}>Detalle de venta</Text>
              <Text style={s.saleDetailsHeaderSubtitle}>
                {selectedVenta ? `ID ${selectedVenta.id.slice(0, 8).toUpperCase()}` : 'Sin referencia'}
              </Text>
            </View>
          </View>
          <Pressable style={s.saleDetailsHeaderClose} onPress={onClose}>
            <Ionicons name="close" size={20} color="#EDE9FE" />
          </Pressable>
        </LinearGradient>
      )}
    >
      {selectedVenta ? (
        <View style={s.saleDetailsHeroCard}>
          <View style={s.saleDetailsHeroTopRow}>
            <View style={s.saleDetailsHeroTotalWrap}>
              <Text style={s.saleDetailsHeroLabel}>Total pagado</Text>
              <StockyMoneyText value={selectedVenta.total} style={s.saleDetailsHeroTotal} />
            </View>
            <View
              style={[
                s.saleDetailsHeroMethodBadge,
                { backgroundColor: selectedVentaPaymentTheme?.backgroundColor || '#DCFCE7' },
              ]}
            >
              {isBankPaymentMethod(selectedVenta.payment_method) ? (
                <Image source={getBankLogoSource(selectedVenta.payment_method)!} style={s.saleDetailsHeroMethodLogo} resizeMode="contain" />
              ) : (
                <Ionicons
                  name={selectedVentaPaymentTheme?.icon || 'cash-outline'}
                  size={14}
                  color={selectedVentaPaymentTheme?.iconColor || '#16A34A'}
                />
              )}
              <Text
                style={[
                  s.saleDetailsHeroMethodBadgeText,
                  { color: selectedVentaPaymentTheme?.textColor || '#166534' },
                ]}
              >
                {getPaymentMethodLabel(selectedVenta.payment_method)}
              </Text>
            </View>
          </View>
          <View style={s.saleDetailsHeroMetaGrid}>
            <View style={s.saleDetailsHeroMetaItem}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={s.saleDetailsHeroMetaText}>{formatDateTime(selectedVenta.created_at)}</Text>
            </View>
            <View style={s.saleDetailsHeroMetaItem}>
              <Ionicons name="person-outline" size={14} color="#64748B" />
              <Text style={s.saleDetailsHeroMetaText}>{selectedVenta.seller_name || 'Vendedor'}</Text>
            </View>
            <View style={s.saleDetailsHeroMetaItem}>
              <Ionicons name="basket-outline" size={14} color="#64748B" />
              <Text style={s.saleDetailsHeroMetaText}>
                {selectedVentaItemsCount} {selectedVentaItemsCount === 1 ? 'unidad' : 'unidades'}
              </Text>
            </View>
          </View>

          {selectedVenta.payment_method === 'cash' ? (
            <View style={s.saleDetailsHeroCashGrid}>
              <View style={s.saleDetailsHeroCashCard}>
                <Text style={s.saleDetailsHeroCashLabel}>Recibido</Text>
                {selectedVenta.amount_received !== null ? (
                  <StockyMoneyText value={selectedVenta.amount_received} style={s.saleDetailsHeroCashValue} />
                ) : (
                  <Text style={s.saleDetailsHeroCashEmpty}>-</Text>
                )}
              </View>
              <View style={s.saleDetailsHeroCashCard}>
                <Text style={s.saleDetailsHeroCashLabel}>Cambio</Text>
                {selectedVenta.change_amount !== null ? (
                  <StockyMoneyText value={selectedVenta.change_amount} style={s.saleDetailsHeroCashValue} />
                ) : (
                  <Text style={s.saleDetailsHeroCashEmpty}>-</Text>
                )}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {ventaDetailsError ? (
        <View style={s.saleDetailsErrorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={s.saleDetailsErrorText}>{ventaDetailsError}</Text>
        </View>
      ) : null}

      <View style={s.saleDetailsItemsSectionHeader}>
        <Text style={s.saleDetailsItemsSectionTitle}>Productos vendidos</Text>
        <View style={s.saleDetailsItemsCountBadge}>
          <Text style={s.saleDetailsItemsCountText}>
            {selectedVentaDetails.length} {selectedVentaDetails.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
      {loadingVentaDetails ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {!loadingVentaDetails && selectedVentaDetails.length === 0 ? (
        <Text style={s.emptyText}>No hay detalles para esta venta.</Text>
      ) : null}
      {!loadingVentaDetails && selectedVentaDetails.length > 0 ? (
        <View style={s.saleDetailsListCard}>
          <FlatList
            data={selectedVentaDetails}
            keyExtractor={(item) => item.id}
            style={s.saleDetailsListScroll}
            contentContainerStyle={s.saleDetailsListScrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
            renderItem={({ item, index }) => (
              <View
                style={[
                  s.saleDetailsListRow,
                  index < selectedVentaDetails.length - 1 && s.saleDetailsListRowDivider,
                ]}
              >
                <View style={s.saleDetailsListRowLeft}>
                  <View style={s.saleDetailsQtyBadge}>
                    <Text style={s.saleDetailsQtyBadgeText}>{item.quantity}</Text>
                  </View>
                  <View style={s.saleDetailsListMain}>
                    <Text style={s.saleDetailsListName}>{getOrderItemName(item as unknown as MesaOrderItem)}</Text>
                    <Text style={s.saleDetailsListMeta}>
                      <StockyMoneyText value={item.unit_price} style={s.saleDetailsListMeta} /> por unidad
                    </Text>
                  </View>
                </View>
                <StockyMoneyText value={item.subtotal} style={s.saleDetailsListSubtotal} />
              </View>
            )}
            ListFooterComponent={(
              <View style={s.saleDetailsListFooter}>
                <Text style={s.saleDetailsListFooterLabel}>Total final</Text>
                <StockyMoneyText value={selectedVenta?.total || 0} style={s.saleDetailsListFooterValue} />
              </View>
            )}
          />
        </View>
      ) : null}
    </StockyModal>
  );
}
