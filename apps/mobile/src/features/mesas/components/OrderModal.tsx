import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { StockyModal } from '../../../ui/StockyModal';
import type {
  ComboComponentShortage,
  MesaOrderCatalogItem,
  MesaOrderItem,
  StockShortage,
} from '../../../services/mesaOrderService';
import type { BusinessContext, MesaRecord } from '../../../services/mesasService';
import { CatalogResultsList } from './CatalogResultsList';
import { OrderItemRow } from './OrderItemRow';
import { StockShortageBanner } from './StockShortageBanner';

export type OrderModalProps = {
  visible: boolean;
  session: Session;
  context: BusinessContext | null | undefined;

  orderState: {
    selectedMesa: MesaRecord | null;
    orderModalTitle: string;
    orderTotal: number;
    orderItems: MesaOrderItem[];
    filteredCatalog: MesaOrderCatalogItem[];
    searchCatalog: string;
    isCatalogLoading: boolean;
    loadingOrder: boolean;
    isSavingOrder: boolean;
    isClosingOrder: boolean;
    releasingEmptyOrder: boolean;
    isPrintInProgress: boolean;
    mutatingOrderItemId: string | null;
    insufficientItems: StockShortage[];
    insufficientComboComponents: ComboComponentShortage[];
  };

  actions: {
    onDismiss: () => void;
    onSaveOrder: () => void;
    onPrintKitchen: () => void;
    onCloseOrder: () => void;
    onCatalogItemPress: (item: MesaOrderCatalogItem) => void;
    onUpdateOrderItemQuantity: (item: MesaOrderItem, delta: number) => void;
    onSearchChange: (query: string) => void;
    resolveOrderItemDisplayName: (item: MesaOrderItem) => string;
  };

  isKeyboardVisible: boolean;
};

export const OrderModal = React.memo(function OrderModal({ visible, orderState, actions, isKeyboardVisible }: OrderModalProps) {
  const {
    orderModalTitle,
    orderTotal,
    orderItems,
    filteredCatalog,
    searchCatalog,
    isCatalogLoading,
    loadingOrder,
    isSavingOrder,
    isClosingOrder,
    releasingEmptyOrder,
    isPrintInProgress,
    mutatingOrderItemId,
    insufficientItems,
    insufficientComboComponents,
  } = orderState;

  const {
    onDismiss,
    onSaveOrder,
    onPrintKitchen,
    onCloseOrder,
    onCatalogItemPress,
    onUpdateOrderItemQuantity,
    onSearchChange,
    resolveOrderItemDisplayName,
  } = actions;

  return (
    <StockyModal
      visible={visible}
      onClose={() => {
        void onDismiss();
      }}
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
      deferFallback={<View style={styles.orderModalDeferred}></View>}
      sheetStyle={styles.orderModalSheet}
      headerSlot={
        <View style={styles.orderModalHeader}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orderModalHeaderIcon}
          >
            <Ionicons name="cart-outline" size={32} color="#D1D5DB" />
          </LinearGradient>
          <Text style={styles.orderModalHeaderTitle}>{orderModalTitle}</Text>
        </View>
      }
      contentContainerStyle={styles.orderModalContent}
      footerStyle={styles.orderModalFooter}
      footer={
        <View style={styles.orderFooterContainer}>
          <View style={styles.orderFooterTotalBlock}>
            <Text style={styles.orderFooterTotalLabel}>Total a pagar:</Text>
            <StockyMoneyText value={orderTotal} style={styles.orderFooterTotalValue} />
          </View>

          <Pressable
            style={[
              styles.orderActionButton,
              (releasingEmptyOrder || isSavingOrder) && styles.actionButtonDisabled,
            ]}
            onPress={() => {
              void onSaveOrder();
            }}
            disabled={releasingEmptyOrder || isSavingOrder}
          >
            <Ionicons name="save-outline" size={20} color="#111827" />
            <Text style={styles.orderActionButtonText}>
              {releasingEmptyOrder || isSavingOrder ? 'Guardando...' : 'Guardar'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.orderActionButton,
              styles.orderPrintButton,
              (orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress) &&
                styles.orderActionButtonDisabledLight,
            ]}
            onPress={onPrintKitchen}
            disabled={orderItems.length === 0 || releasingEmptyOrder || isPrintInProgress}
          >
            <Ionicons
              name="print-outline"
              size={20}
              color={orderItems.length === 0 ? '#93A5CD' : '#64748B'}
            />
            <Text style={[styles.orderActionButtonText, styles.orderPrintButtonText]}>
              {isPrintInProgress ? 'Imprimiendo...' : 'Imprimir para cocina'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCloseOrder}
            disabled={isClosingOrder || releasingEmptyOrder}
            style={
              orderItems.length === 0 || isClosingOrder || releasingEmptyOrder
                ? styles.actionButtonDisabled
                : undefined
            }
          >
            <LinearGradient
              colors={
                orderItems.length === 0 || isClosingOrder || releasingEmptyOrder
                  ? ['#C4B5FD', '#C4B5FD']
                  : ['#A78BFA', '#7C3AED']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.orderCloseButton}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#E5E7EB" />
              <Text style={styles.orderCloseButtonText}>
                {isClosingOrder ? 'Procesando...' : 'Cerrar Orden'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      <CatalogResultsList
        catalog={filteredCatalog}
        searchQuery={searchCatalog}
        onSearchChange={onSearchChange}
        onItemPress={onCatalogItemPress}
        loading={isCatalogLoading}
        disabled={loadingOrder || isClosingOrder || releasingEmptyOrder}
        isKeyboardVisible={isKeyboardVisible}
      />

      <Text style={styles.orderItemsTitle}>Items en la orden</Text>
      {orderItems.length === 0 ? (
        <View style={styles.orderItemsEmpty}>
          <Ionicons name="cart-outline" size={56} color="#0F172A" />
          <Text style={styles.orderItemsEmptyText}>No hay items en esta orden</Text>
        </View>
      ) : null}
      {orderItems.length > 0 ? (
        <FlatList
          data={orderItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          style={{ flexGrow: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const busy = mutatingOrderItemId === item.id;
            return (
              <OrderItemRow
                item={item}
                itemName={resolveOrderItemDisplayName(item)}
                busy={busy}
                disabled={isClosingOrder || releasingEmptyOrder}
                onChangeQuantity={onUpdateOrderItemQuantity}
              />
            );
          }}
        />
      ) : null}

      <StockShortageBanner
        insufficientItems={insufficientItems}
        insufficientComboComponents={insufficientComboComponents}
      />
    </StockyModal>
  );
});

const styles = StyleSheet.create({
  orderModalSheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  orderModalHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderModalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderModalHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  orderModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  orderModalFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  orderModalDeferred: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  orderFooterContainer: {
    gap: 10,
  },
  orderFooterTotalBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  orderFooterTotalLabel: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  orderFooterTotalValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  orderActionButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orderActionButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  orderPrintButton: {
    borderColor: '#DBE2F2',
  },
  orderPrintButtonText: {
    color: '#6B7FAF',
  },
  orderCloseButton: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orderCloseButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
  },
  orderActionButtonDisabledLight: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  orderItemsTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  orderItemsEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  orderItemsEmptyText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});
