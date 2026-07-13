import { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { PaymentMethodSelector } from '../../../ui/PaymentMethodSelector';
import type {
  CompraCartItem,
  CompraProductRecord,
  CompraSupplierRecord,
} from '../../../services/comprasService';
import { getPaymentMethodLabel } from '../../../utils/paymentMethods';
import { comprasStyles as s } from '../comprasStyles';

type CreatePurchaseModalProps = {
  visible: boolean;
  creatingPurchase: boolean;
  cart: CompraCartItem[];
  cartTotal: number;
  paymentMethod: string;
  supplierId: string;
  suppliers: CompraSupplierRecord[];
  productsFiltered: CompraProductRecord[];
  loadingCatalog: boolean;
  productSearch: string;
  purchaseSupplierLabel: string;
  onClose: () => void;
  onPaymentMethodChange: (method: string) => void;
  onSupplierSelect: (supplierId: string) => void;
  onProductSearchChange: (value: string) => void;
  onAddProduct: (product: CompraProductRecord) => void;
  onUpdateCartQuantity: (productId: string, quantity: number) => void;
  onClearForm: () => void;
  onSubmit: () => void;
};

export const CreatePurchaseModal = memo(function CreatePurchaseModal({
  visible,
  creatingPurchase,
  cart,
  cartTotal,
  paymentMethod,
  supplierId,
  suppliers,
  productsFiltered,
  loadingCatalog,
  productSearch,
  purchaseSupplierLabel,
  onClose,
  onPaymentMethodChange,
  onSupplierSelect,
  onProductSearchChange,
  onAddProduct,
  onUpdateCartQuantity,
  onClearForm,
  onSubmit,
}: CreatePurchaseModalProps) {
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={16}
      bodyFlex
      sheetStyle={s.purchaseOrderModalSheet}
      perfTag="compras.form_nueva_compra"
      onClose={() => {
        if (creatingPurchase) return;
        onClose();
      }}
      hideCloseButton
      headerSlot={
        <View style={s.purchaseOrderModalHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.purchaseOrderModalHeaderIcon}
          >
            <Ionicons name="cart-outline" size={30} color="#D1D5DB" />
          </LinearGradient>
          <Text style={s.purchaseOrderModalHeaderTitle}>{t('comprasSection.newPurchase')}</Text>
          <Pressable
            style={[s.purchaseOrderModalHeaderClose, creatingPurchase && s.buttonDisabled]}
            onPress={() => {
              if (creatingPurchase) return;
              onClose();
            }}
            disabled={creatingPurchase}
          >
            <Ionicons name="close" size={34} color="#111827" />
          </Pressable>
        </View>
      }
      contentContainerStyle={s.purchaseOrderModalContent}
      footerStyle={s.purchaseOrderModalFooter}
      footer={
        <View style={s.purchaseOrderFooterContainer}>
          <View style={s.purchaseOrderFooterTotalBlock}>
            <Text style={s.purchaseOrderFooterTotalLabel}>{t('comprasSection.totalPurchase')}</Text>
            <StockyMoneyText value={cartTotal} style={s.purchaseOrderFooterTotalValue} />
          </View>

          <View style={s.saleActions}>
            <Pressable
              style={s.purchaseOrderSecondaryButton}
              onPress={onClearForm}
              disabled={creatingPurchase || cart.length === 0}
            >
              <Text style={s.purchaseOrderSecondaryButtonText}>{t('ventasSection.clear')}</Text>
            </Pressable>
            <Pressable
              style={[
                s.purchaseOrderPrimaryButton,
                (creatingPurchase || cart.length === 0) && s.buttonDisabled,
              ]}
              onPress={onSubmit}
              disabled={creatingPurchase || cart.length === 0}
            >
              <Text style={s.purchaseOrderPrimaryButtonText}>
                {creatingPurchase
                  ? t('comprasSection.registering')
                  : t('comprasSection.registerPurchase')}
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={s.purchaseOrderBlock}>
        <View style={s.purchaseOrderBlockHeader}>
          <Text style={s.purchaseOrderBlockTitle}>{t('comprasSection.supplier')}</Text>
          <Text style={s.purchaseOrderBlockHint}>{purchaseSupplierLabel}</Text>
        </View>
        <Text style={s.helperText}>{t('comprasSection.selectSupplierHint')}</Text>
        <View style={s.filterRow}>
          {suppliers.map((supplier) => {
            const selected = supplierId === supplier.id;
            const label =
              supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
            return (
              <Pressable
                key={supplier.id}
                style={[s.filterChip, selected && s.filterChipSelected]}
                onPress={() => onSupplierSelect(supplier.id)}
              >
                <Text style={[s.filterChipText, selected && s.filterChipTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.catalogSearchHeader}>
        <Ionicons name="search-outline" size={24} color="#111827" />
        <Text style={s.catalogSearchHeaderText}>{t('comprasSection.addProduct')}</Text>
      </View>
      <TextInput
        value={productSearch}
        onChangeText={onProductSearchChange}
        placeholder={
          supplierId ? t('comprasSection.searchProduct') : t('comprasSection.selectSupplierFirst')
        }
        placeholderTextColor={STOCKY_COLORS.textMuted}
        style={s.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        editable={Boolean(supplierId)}
      />

      {!supplierId ? (
        <Text style={s.emptyText}>{t('comprasSection.selectSupplierCatalog')}</Text>
      ) : loadingCatalog ? (
        <View style={s.modalLoadingInline}>
          <ActivityIndicator color={STOCKY_COLORS.primary900} />
          <Text style={s.emptyText}>{t('comprasSection.loadingProducts')}</Text>
        </View>
      ) : productsFiltered.length === 0 ? (
        <Text style={s.emptyText}>{t('comprasSection.noProductsForSupplier')}</Text>
      ) : (
        <View style={s.catalogResultsCard}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="never"
            style={{ maxHeight: 240 }}
          >
            {productsFiltered.map((product, index) => (
              <Pressable
                key={product.id}
                style={[
                  s.catalogResultRow,
                  index < productsFiltered.length - 1 && s.catalogResultRowDivider,
                ]}
                onPress={() => onAddProduct(product)}
                disabled={creatingPurchase}
              >
                <View style={s.catalogResultLeft}>
                  <Text style={s.catalogResultName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={s.catalogResultMeta}>
                    {t('comprasSection.stock')} {product.stock}
                  </Text>
                </View>
                <View style={s.catalogResultRight}>
                  <StockyMoneyText value={product.purchase_price} style={s.catalogResultPrice} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={s.orderItemsTitle}>{t('comprasSection.purchaseItems')}</Text>
      {cart.length === 0 ? (
        <View style={s.orderItemsEmpty}>
          <Ionicons name="cart-outline" size={56} color="#0F172A" />
          <Text style={s.orderItemsEmptyText}>{t('comprasSection.noItemsYet')}</Text>
        </View>
      ) : (
        cart.map((item) => (
          <View key={item.product_id} style={s.orderItemCard}>
            <View style={s.orderItemTopRow}>
              <Text style={s.orderItemName}>{item.product_name}</Text>
              <StockyMoneyText
                value={Number(item.quantity || 0) * Number(item.unit_price || 0)}
                style={s.orderItemTotal}
              />
            </View>

            <View style={s.orderItemControlsRow}>
              <View style={s.orderItemStepper}>
                <Pressable
                  style={s.orderItemStepperButton}
                  onPress={() =>
                    onUpdateCartQuantity(item.product_id, Number(item.quantity || 0) - 1)
                  }
                >
                  <Text style={s.orderItemMinusText}>-</Text>
                </Pressable>
                <Text style={s.orderItemQtyText}>{item.quantity}</Text>
                <Pressable
                  style={s.orderItemStepperButton}
                  onPress={() =>
                    onUpdateCartQuantity(item.product_id, Number(item.quantity || 0) + 1)
                  }
                >
                  <Text style={s.orderItemPlusText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}

      <View style={s.purchasePaymentBlock}>
        <View style={s.purchasePaymentHeader}>
          <Text style={s.purchasePaymentTitle}>{t('comprasSection.payment')}</Text>
          <Text style={s.purchasePaymentHint}>{getPaymentMethodLabel(paymentMethod)}</Text>
        </View>
        <PaymentMethodSelector value={paymentMethod} onChange={onPaymentMethodChange} />
      </View>
    </StockyModal>
  );
});
