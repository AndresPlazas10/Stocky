import React, { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { StockyModal } from '../../../ui/StockyModal';
import type {
  ComboComponentShortage,
  MesaOrderCatalogItem,
  MesaOrderItem,
  StockShortage,
} from '../../../services/mesaOrderService';
import type { MesaRecord } from '../../../services/mesasService';
import { CatalogResultsList } from './CatalogResultsList';
import { OrderItemRow } from './OrderItemRow';
import { StockShortageBanner } from './StockShortageBanner';

export type OrderModalProps = {
  visible: boolean;

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
    orderModalError?: string | null;
    insufficientItems: StockShortage[];
    insufficientComboComponents: ComboComponentShortage[];
    hasPendingChanges?: boolean;
    orderNotes?: string;
    isSavingNotes?: boolean;
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
    onSaveNotes?: (notes: string) => void;
  };
};

const OrderItemSeparator = () => <View style={styles.orderItemSeparator} />;

const orderItemKeyExtractor = (item: MesaOrderItem) => item.id;

export const OrderModal = React.memo(function OrderModal({
  visible,
  orderState,
  actions,
}: OrderModalProps) {
  const { t } = useTranslation('mesas');
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
    orderModalError = null,
    insufficientItems,
    insufficientComboComponents,
    hasPendingChanges,
    orderNotes = '',
    isSavingNotes = false,
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
    onSaveNotes,
  } = actions;

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    setNotesDraft(orderNotes || '');
    setNotesOpen(false);
  }, [orderNotes, visible]);

  const handleSaveOrderWithNotes = () => {
    if (notesOpen && onSaveNotes && notesDraft !== orderNotes) {
      onSaveNotes(notesDraft);
    }
    void onSaveOrder();
  };

  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (orderItems.length > 0) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [orderItems.length]);

  const renderOrderItem = useCallback(
    ({ item }: { item: MesaOrderItem }) => {
      return (
        <OrderItemRow
          item={item}
          itemName={resolveOrderItemDisplayName(item)}
          disabled={isClosingOrder || releasingEmptyOrder}
          onChangeQuantity={onUpdateOrderItemQuantity}
        />
      );
    },
    [
      resolveOrderItemDisplayName,
      isClosingOrder,
      releasingEmptyOrder,
      onUpdateOrderItemQuantity,
    ],
  );

  return (
    <StockyModal
      visible={visible}
      onClose={() => {
        void onDismiss();
      }}
      hideCloseButton
      backdropVariant="blur"
      layout="centered"
      bodyFlex
      deferContent
      deferBehavior="hide"
      deferFallback={<View style={styles.orderModalDeferred}></View>}
      sheetStyle={styles.orderModalSheet}
      scrollViewRef={scrollViewRef}
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
          <View style={styles.orderModalHeaderTitleBlock}>
            <Text style={styles.orderModalHeaderTitle}>{orderModalTitle}</Text>
          </View>
        </View>
      }
      contentContainerStyle={styles.orderModalContent}
      footerStyle={styles.orderModalFooter}
      footer={
        <View style={styles.orderFooterContainer}>
          <View style={styles.orderFooterTotalBlock}>
            <Text style={styles.orderFooterTotalLabel}>{t('labels.totalToPay')}:</Text>
            {loadingOrder ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <StockyMoneyText value={orderTotal} style={styles.orderFooterTotalValue} />
            )}
          </View>

          <Pressable
            style={[
              styles.orderActionButton,
              (releasingEmptyOrder || isSavingOrder) && styles.actionButtonDisabled,
            ]}
            onPress={() => {
              handleSaveOrderWithNotes();
            }}
            disabled={releasingEmptyOrder || isSavingOrder}
          >
            {releasingEmptyOrder || isSavingOrder ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <View style={styles.saveButtonIconContainer}>
                <Ionicons name="save-outline" size={20} color="#111827" />
                {hasPendingChanges && <View style={styles.pendingChangesDot} />}
              </View>
            )}
            <Text style={styles.orderActionButtonText}>
              {releasingEmptyOrder || isSavingOrder ? t('print.saving') : t('buttons.saveOrder')}
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
            {isPrintInProgress ? (
              <ActivityIndicator size="small" color="#64748B" />
            ) : (
              <Ionicons
                name="print-outline"
                size={20}
                color={orderItems.length === 0 ? '#93A5CD' : '#64748B'}
              />
            )}
            <Text style={[styles.orderActionButtonText, styles.orderPrintButtonText]}>
              {isPrintInProgress ? t('print.printing') : t('buttons.printKitchen')}
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
                {isClosingOrder ? t('print.processing') : t('buttons.closeOrder')}
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
      />

      {orderModalError ? (
        <View style={styles.orderModalErrorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#991B1B" />
          <Text style={styles.orderModalErrorText}>{orderModalError}</Text>
        </View>
      ) : null}

      <Text style={styles.orderItemsTitle}>{t('labels.orderItems')}</Text>
      {orderItems.length === 0 ? (
        <View style={styles.orderItemsEmpty}>
          <Ionicons name="cart-outline" size={56} color="#0F172A" />
          <Text style={styles.orderItemsEmptyText}>{t('labels.noItems')}</Text>
        </View>
      ) : null}
      {orderItems.length > 0 ? (
        <FlatList
          data={orderItems}
          keyExtractor={orderItemKeyExtractor}
          scrollEnabled={false}
          style={styles.orderItemsFlatList}
          ItemSeparatorComponent={OrderItemSeparator}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          renderItem={renderOrderItem}
        />
      ) : null}

      <StockShortageBanner
        insufficientItems={insufficientItems}
        insufficientComboComponents={insufficientComboComponents}
      />

      <View style={styles.orderNotesSection}>
        {orderNotes && !notesOpen ? (
          <View style={styles.orderNotesPreview}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#92400E" />
            <Text style={styles.orderNotesPreviewText}>{orderNotes}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => setNotesOpen((prev) => !prev)}
          disabled={isSavingNotes}
          style={({ pressed }) => [styles.orderNotesToggle, pressed && styles.orderNotesTogglePressed]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4F46E5" />
          <Text style={styles.orderNotesToggleText}>
            {orderNotes ? t('buttons.editNote', 'Editar comentario') : t('buttons.addNote', 'Agregar comentario')}
          </Text>
        </Pressable>

        {notesOpen ? (
          <View style={styles.orderNotesEditor}>
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder={t('buttons.orderNotesPlaceholder', 'Escribe un comentario para la cocina...')}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              style={styles.orderNotesInput}
            />
          </View>
        ) : null}
      </View>
    </StockyModal>
  );
});

const styles = StyleSheet.create({
  orderItemsFlatList: {
    flexGrow: 0,
  },
  orderItemSeparator: {
    height: 10,
  },
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
  orderModalHeaderTitleBlock: {
    flex: 1,
    gap: 4,
  },
  orderModalHeaderTitle: {
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
  orderModalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  orderModalErrorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  saveButtonIconContainer: {
    position: 'relative',
    width: 20,
    height: 20,
  },
  pendingChangesDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  orderNotesSection: {
    marginTop: 4,
    gap: 8,
  },
  orderNotesPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  orderNotesPreviewText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  orderNotesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
  },
  orderNotesTogglePressed: {
    opacity: 0.8,
  },
  orderNotesToggleText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  orderNotesEditor: {
    gap: 8,
  },
  orderNotesInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
