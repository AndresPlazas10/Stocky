import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { PaymentMethodSelector } from '../../../ui/PaymentMethodSelector';
import { formatCop } from '../../../utils/money';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';
import type { VentaCartItem } from '../../../services/ventasService';
import { getPaymentMethodLabel } from '../../../utils/paymentMethods';
import type { PaymentMethod } from '../../../utils/paymentMethods';
import { cartReferenceKey } from '../hooks/useVentaCart';
import { ventasStyles as s } from '../ventasStyles';

const CartItemRow = memo(function CartItemRow({
  item,
  isKeyboardVisible,
  onUpdateQuantity,
}: {
  item: VentaCartItem;
  isKeyboardVisible: boolean;
  onUpdateQuantity: (item: VentaCartItem, qty: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.orderItemCard}>
      <View style={s.orderItemTopRow}>
        <Text numberOfLines={1} style={s.orderItemName}>
          {item.name}
        </Text>
        <StockyMoneyText value={Number(item.subtotal || 0)} style={s.orderItemTotal} />
      </View>
      <View style={s.orderItemMetaRow}>
        <View style={s.orderItemUnitChip}>
          <Text style={s.orderItemUnitChipText}>
            <StockyMoneyText value={Number(item.unit_price || 0)} style={s.orderItemUnitChipText} />{' '}
            {t('ventasSection.perUnit')}
          </Text>
        </View>
        <Text style={s.orderItemSubtotalLabel}>{t('ventasSection.subtotal')}</Text>
      </View>
      <View style={s.orderItemDivider} />
      <View style={s.orderItemControlsRow}>
        <View style={s.orderItemStepper}>
          <Pressable
            style={s.orderItemStepperButton}
            onPressIn={() => {
              if (isKeyboardVisible) {
                Keyboard.dismiss();
                return;
              }
              onUpdateQuantity(item, Number(item.quantity || 0) - 1);
            }}
          >
            <Text style={s.orderItemMinusText}>-</Text>
          </Pressable>
          <Text style={s.orderItemQtyText}>{item.quantity}</Text>
          <Pressable
            style={s.orderItemStepperButton}
            onPressIn={() => {
              if (isKeyboardVisible) {
                Keyboard.dismiss();
                return;
              }
              onUpdateQuantity(item, Number(item.quantity || 0) + 1);
            }}
          >
            <Text style={s.orderItemPlusText}>+</Text>
          </Pressable>
        </View>
        <Pressable
          style={[s.saleDeleteButton, s.saleActionHalf]}
          onPress={() => onUpdateQuantity(item, 0)}
        >
          <Ionicons name="trash-outline" size={20} color="#2563EB" />
          <Text style={s.saleDeleteText}>{t('ventasSection.delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

type CreateSaleModalProps = {
  visible: boolean;
  submitting: boolean;
  cart: VentaCartItem[];
  cartTotal: number;
  paymentMethod: PaymentMethod;
  amountReceived: string;
  cashChangeData: { isValid: boolean; change: number } | null;
  isKeyboardVisible: boolean;
  catalogItems: MesaOrderCatalogItem[];
  loadingCatalog: boolean;
  searchCatalog: string;
  isSaleSearchFocused: boolean;
  hasCatalogQuery: boolean;
  catalogFiltered: MesaOrderCatalogItem[];
  onClose: () => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onAmountReceivedChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSearchFocusChange: (focused: boolean) => void;
  onAddToCart: (item: MesaOrderCatalogItem) => void;
  onUpdateCartQuantity: (item: VentaCartItem, qty: number) => void;
  onClearCart: () => void;
  onSubmit: () => void;
};

export const CreateSaleModal = memo(function CreateSaleModal({
  visible,
  submitting,
  cart,
  cartTotal,
  paymentMethod,
  amountReceived,
  cashChangeData,
  isKeyboardVisible,
  loadingCatalog,
  searchCatalog,
  isSaleSearchFocused,
  hasCatalogQuery,
  catalogFiltered,
  onClose,
  onPaymentMethodChange,
  onAmountReceivedChange,
  onSearchChange,
  onSearchFocusChange,
  onAddToCart,
  onUpdateCartQuantity,
  onClearCart,
  onSubmit,
}: CreateSaleModalProps) {
  const { t } = useTranslation();
  const canSubmit =
    !submitting && cart.length > 0 && (paymentMethod !== 'cash' || cashChangeData?.isValid);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const handleCloseButton = useCallback(() => {
    if (submitting) return;
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  }, [submitting, isKeyboardVisible, onClose]);

  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      bodyFlex
      sheetStyle={s.saleOrderModalSheet}
      perfTag="ventas.form_nueva_venta"
      onClose={handleClose}
      hideCloseButton
      headerSlot={
        <View style={s.saleOrderModalHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.saleOrderModalHeaderIcon}
          >
            <Ionicons name="cart-outline" size={30} color="#D1D5DB" />
          </LinearGradient>
          <Text style={s.saleOrderModalHeaderTitle}>{t('ventasSection.newSale')}</Text>
          <Pressable
            style={[s.saleOrderModalHeaderClose, submitting && s.buttonDisabled]}
            onPress={handleCloseButton}
            disabled={submitting}
          >
            <Ionicons name="close" size={34} color="#111827" />
          </Pressable>
        </View>
      }
      contentContainerStyle={s.saleOrderModalContent}
      footerStyle={s.saleOrderModalFooter}
      footer={
        <View style={s.saleOrderFooterContainer}>
          <View style={s.saleOrderFooterTotalBlock}>
            <Text style={s.saleOrderFooterTotalLabel}>{t('ventasSection.totalToCollect')}</Text>
            <StockyMoneyText value={cartTotal} style={s.saleOrderFooterTotalValue} />
          </View>

          <View style={s.saleActions}>
            <Pressable
              style={s.saleOrderSecondaryButton}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                  return;
                }
                onClearCart();
              }}
              disabled={submitting || cart.length === 0}
            >
              <Text style={s.saleOrderSecondaryButtonText}>{t('ventasSection.clear')}</Text>
            </Pressable>
            <Pressable
              style={[s.saleOrderPrimaryButton, !canSubmit && s.buttonDisabled]}
              onPress={() => {
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                  return;
                }
                onSubmit();
              }}
              disabled={!canSubmit}
            >
              <Text style={s.saleOrderPrimaryButtonText}>
                {submitting ? t('ventasSection.processing') : t('ventasSection.confirmSale')}
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={s.catalogSearchHeader}>
        <Ionicons name="search-outline" size={24} color="#111827" />
        <Text style={s.catalogSearchHeaderText}>{t('ventasSection.addProductOrCombo')}</Text>
      </View>

      <TextInput
        value={searchCatalog}
        onChangeText={onSearchChange}
        placeholder={t('ventasSection.searchByName')}
        placeholderTextColor={STOCKY_COLORS.textMuted}
        style={[s.searchInput, isSaleSearchFocused && s.searchInputFocused]}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => onSearchFocusChange(true)}
        onBlur={() => onSearchFocusChange(false)}
      />

      {loadingCatalog && hasCatalogQuery ? (
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      ) : null}

      {!hasCatalogQuery ? <Text style={s.emptyText}>{t('ventasSection.searchHint')}</Text> : null}
      {!loadingCatalog && hasCatalogQuery && catalogFiltered.length === 0 ? (
        <Text style={s.emptyText}>{t('ventasSection.noSearchResults')}</Text>
      ) : null}

      {hasCatalogQuery ? (
        <View style={s.catalogResultsCard}>
          <ScrollView
            style={s.catalogResultsScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="never"
            showsVerticalScrollIndicator
          >
            {catalogFiltered.map((item, index) => (
              <Pressable
                key={`${item.item_type}:${item.id}`}
                style={[
                  s.catalogResultRow,
                  index < catalogFiltered.length - 1 && s.catalogResultRowDivider,
                ]}
                disabled={false}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                    return;
                  }
                  onAddToCart(item);
                  onSearchChange('');
                }}
              >
                <View style={s.catalogResultLeft}>
                  <Text style={s.catalogResultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.item_type === 'combo' ? (
                    <View style={s.comboPill}>
                      <Text style={s.comboPillText}>{t('ventasSection.combo')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.catalogResultRight}>
                  <StockyMoneyText
                    value={Number(item.sale_price || 0)}
                    style={s.catalogResultPrice}
                  />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={s.orderItemsTitle}>{t('ventasSection.itemsInSale')}</Text>
      {cart.length === 0 ? (
        <View style={s.orderItemsEmpty}>
          <Ionicons name="cart-outline" size={56} color="#0F172A" />
          <Text style={s.orderItemsEmptyText}>{t('ventasSection.noItems')}</Text>
        </View>
      ) : null}
      {cart.length > 0
        ? cart.map((item) => (
            <CartItemRow
              key={cartReferenceKey(item)}
              item={item}
              isKeyboardVisible={isKeyboardVisible}
              onUpdateQuantity={onUpdateCartQuantity}
            />
          ))
        : null}

      <View style={s.salePaymentBlock}>
        <View style={s.salePaymentHeader}>
          <Text style={s.salePaymentTitle}>{t('ventasSection.payment')}</Text>
          <Text style={s.salePaymentHint}>{getPaymentMethodLabel(paymentMethod)}</Text>
        </View>
        <PaymentMethodSelector
          value={paymentMethod}
          onChange={(m) => onPaymentMethodChange(m as PaymentMethod)}
          blockInteractions={isKeyboardVisible}
          onBlockedInteraction={() => Keyboard.dismiss()}
        />
        {paymentMethod === 'cash' ? (
          <>
            <TextInput
              value={amountReceived}
              onChangeText={onAmountReceivedChange}
              placeholder={t('ventasSection.amountReceived')}
              placeholderTextColor={STOCKY_COLORS.textMuted}
              keyboardType="numeric"
              style={s.saleComposerCashInput}
            />
            <Text style={[s.cashInfo, cashChangeData?.isValid ? s.cashInfoOk : s.cashInfoError]}>
              {cashChangeData?.isValid
                ? `${t('ventasSection.change')} ${formatCop(cashChangeData.change)}`
                : t('ventasSection.invalidAmount')}
            </Text>
          </>
        ) : null}
      </View>
    </StockyModal>
  );
});
