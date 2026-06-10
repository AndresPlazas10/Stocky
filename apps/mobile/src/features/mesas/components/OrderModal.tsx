import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { OrderItemRow } from './OrderItemRow';
import { StockShortageBanner } from './StockShortageBanner';
import type { MesaOrderCatalogItem, MesaOrderItem, StockShortage, ComboComponentShortage } from '../../../services/mesaOrderService';

interface OrderModalProps {
  visible: boolean;
  title: string;
  orderTotal: number;
  searchCatalog: string;
  isSearchFocused: boolean;
  isKeyboardVisible: boolean;
  hasCatalogQuery: boolean;
  isCatalogLoading: boolean;
  filteredCatalog: MesaOrderCatalogItem[];
  orderItems: MesaOrderItem[];
  mutatingOrderItemId: string | null;
  releasingEmptyOrder: boolean;
  isSavingOrder: boolean;
  isClosingOrder: boolean;
  isPrintInProgress: boolean;
  insufficientItems: StockShortage[];
  insufficientComboComponents: ComboComponentShortage[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onAddItem: (item: MesaOrderCatalogItem) => void;
  onUpdateQuantity: (item: MesaOrderItem, delta: number) => void;
  onSave: () => void;
  onPrint: () => void;
  onCloseOrder: () => void;
  resolveItemName: (item: MesaOrderItem) => string;
}

export function OrderModal({
  visible,
  title,
  orderTotal,
  searchCatalog,
  isSearchFocused,
  isKeyboardVisible,
  hasCatalogQuery,
  isCatalogLoading,
  filteredCatalog,
  orderItems,
  mutatingOrderItemId,
  releasingEmptyOrder,
  isSavingOrder,
  isClosingOrder,
  isPrintInProgress,
  insufficientItems,
  insufficientComboComponents,
  onClose,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onAddItem,
  onUpdateQuantity,
  onSave,
  onPrint,
  onCloseOrder,
  resolveItemName,
}: OrderModalProps) {
  const isBusy = isClosingOrder || releasingEmptyOrder;

  return (
    <StockyModal
      visible={visible}
      onClose={onClose}
      hideCloseButton
      backdropVariant="blur"
      layout="centered"
      modalAnimationType="fade"
      animationStyle="web"
      animationDurationMs={420}
      animationScaleFrom={1}
      bodyFlex
      deferContent
      deferBehavior="hide"
      deferFallback={(
        <View style={styles.deferred} />
      )}
      sheetStyle={styles.sheet}
      headerSlot={(
        <View style={styles.header}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerIcon}
          >
            <Ionicons name="cart-outline" size={32} color="#D1D5DB" />
          </LinearGradient>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      )}
      contentContainerStyle={styles.content}
      footerStyle={styles.footer}
      footer={(
        <View style={styles.footerContainer}>
          <View style={styles.footerTotalBlock}>
            <Text style={styles.footerTotalLabel}>Total a pagar:</Text>
            <StockyMoneyText value={orderTotal} style={styles.footerTotalValue} />
          </View>

          <Pressable
            style={[styles.actionButton, (releasingEmptyOrder || isSavingOrder) && styles.disabled]}
            onPress={onSave}
            disabled={releasingEmptyOrder || isSavingOrder}
          >
            <Ionicons name="save-outline" size={20} color="#111827" />
            <Text style={styles.actionButtonText}>
              {(releasingEmptyOrder || isSavingOrder) ? 'Guardando...' : 'Guardar'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.printButton,
              (orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress) && styles.disabledLight,
            ]}
            onPress={onPrint}
            disabled={orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress}
          >
            <Ionicons name="print-outline" size={20} color={orderItems.length === 0 ? '#93A5CD' : '#64748B'} />
            <Text style={[styles.actionButtonText, styles.printButtonText]}>
              {isPrintInProgress ? 'Imprimiendo...' : 'Imprimir para cocina'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCloseOrder}
            disabled={isClosingOrder || releasingEmptyOrder}
            style={(orderItems.length === 0 || isClosingOrder || releasingEmptyOrder) ? styles.disabled : undefined}
          >
            <LinearGradient
              colors={
                (orderItems.length === 0 || isClosingOrder || releasingEmptyOrder)
                  ? ['#C4B5FD', '#C4B5FD']
                  : ['#A78BFA', '#7C3AED']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.closeButton}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#E5E7EB" />
              <Text style={styles.closeButtonText}>
                {isClosingOrder ? 'Procesando...' : 'Cerrar Orden'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.searchHeader}>
        <Ionicons name="search-outline" size={24} color="#111827" />
        <Text style={styles.searchHeaderText}>Agregar Producto o Combo</Text>
      </View>

      <TextInput
        value={searchCatalog}
        onChangeText={onSearchChange}
        placeholder="Buscar por nombre..."
        placeholderTextColor={STOCKY_COLORS.textMuted}
        style={[styles.searchInput, isSearchFocused && styles.searchInputFocused]}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={onSearchFocus}
        onBlur={onSearchBlur}
      />

      {hasCatalogQuery && isCatalogLoading ? (
        <Text style={styles.emptyState}>Cargando productos...</Text>
      ) : hasCatalogQuery && filteredCatalog.length === 0 ? (
        <Text style={styles.emptyState}>No hay resultados en el catalogo.</Text>
      ) : hasCatalogQuery ? (
        <View style={styles.catalogResultsCard}>
          <ScrollView
            style={styles.catalogResultsScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="never"
            showsVerticalScrollIndicator
          >
            {filteredCatalog.map((catalogItem, index) => {
              return (
                <Pressable
                  key={`${catalogItem.item_type}:${catalogItem.id}`}
                  style={[
                    styles.catalogResultRow,
                    index < filteredCatalog.length - 1 && styles.catalogResultRowDivider,
                    isBusy && styles.disabled,
                  ]}
                  disabled={isBusy}
                  onPress={() => {
                    if (isKeyboardVisible) {
                      Keyboard.dismiss();
                      return;
                    }
                    onAddItem(catalogItem);
                  }}
                >
                  <View style={styles.catalogResultLeft}>
                    <Text style={styles.catalogResultName}>{catalogItem.name}</Text>
                    {catalogItem.item_type === 'combo' ? (
                      <View style={styles.comboPill}>
                        <Text style={styles.comboPillText}>Combo</Text>
                      </View>
                    ) : null}
                  </View>
                  <StockyMoneyText value={Number(catalogItem.sale_price || 0)} style={styles.catalogResultPrice} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.orderItemsTitle}>Items en la orden</Text>
      {orderItems.length === 0 ? (
        <View style={styles.orderItemsEmpty}>
          <Ionicons name="cart-outline" size={56} color="#0F172A" />
          <Text style={styles.orderItemsEmptyText}>No hay items en esta orden</Text>
        </View>
      ) : null}
      {orderItems.length > 0 ? (
        orderItems.map((item) => {
          const busy = mutatingOrderItemId === item.id;
          return (
            <OrderItemRow
              key={item.id}
              item={item}
              itemName={resolveItemName(item)}
              busy={busy}
              disabled={isClosingOrder || releasingEmptyOrder}
              onChangeQuantity={onUpdateQuantity}
            />
          );
        })
      ) : null}

      <StockShortageBanner
        insufficientItems={insufficientItems}
        insufficientComboComponents={insufficientComboComponents}
      />
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  deferred: {
    height: 400,
  },
  sheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  header: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  footerContainer: {
    gap: 8,
  },
  footerTotalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  footerTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  footerTotalValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  printButton: {
    backgroundColor: '#F8FAFC',
  },
  printButtonText: {
    color: '#64748B',
  },
  closeButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.7,
  },
  disabledLight: {
    opacity: 0.5,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  searchHeaderText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    minHeight: 52,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  searchInputFocused: {
    borderColor: '#4F46E5',
    borderWidth: 2,
  },
  emptyState: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 12,
  },
  catalogResultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  catalogResultsScroll: {
    maxHeight: 200,
  },
  catalogResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catalogResultRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  catalogResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  catalogResultName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  catalogResultPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  comboPill: {
    backgroundColor: '#F5F3FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  comboPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
  },
  orderItemsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  orderItemsEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  orderItemsEmptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});
