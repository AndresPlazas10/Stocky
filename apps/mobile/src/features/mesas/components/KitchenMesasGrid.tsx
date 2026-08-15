import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../../../theme/tokens';
import type { MesaOrderItem } from '../../../services/mesaOrderService';
import type { MesaRecord } from '../../../services/mesasService';
import { isMesaOccupied, mesaDisplayName, CALL_WINDOW_MS } from '../utils/mesaHelpers';
import { resolveOrderRecencyMs } from '@stocky/shared/mesa-utils';

interface KitchenMesasGridProps {
  mesas: MesaRecord[];
  loading?: boolean;
  loadingItems?: boolean;
  itemsByOrderId: Record<string, MesaOrderItem[]>;
  callingOrderIds: Set<string>;
  mostRecentOrderId?: string | null;
  orderArrivalTsByOrderId?: React.MutableRefObject<Map<string, number>> | null;
  resolveItemName: (item: MesaOrderItem) => string;
  onCallMesa: (mesa: MesaRecord) => void;
}

const ItemSeparator = () => <View style={styles.separator} />;

const keyExtractor = (item: MesaRecord) => item.id;

export const KitchenMesasGrid = React.memo(function KitchenMesasGrid({
  mesas,
  loading = false,
  loadingItems = false,
  itemsByOrderId,
  callingOrderIds,
  mostRecentOrderId = null,
  orderArrivalTsByOrderId = null,
  resolveItemName,
  onCallMesa,
}: KitchenMesasGridProps) {
  const { t } = useTranslation('mesas');
  const occupiedMesas = React.useMemo(() => {
    const occupied = (Array.isArray(mesas) ? mesas : []).filter((mesa) =>
      isMesaOccupied(mesa.status),
    );
    return [...occupied].sort(
      (a, b) =>
        resolveOrderRecencyMs(b, orderArrivalTsByOrderId?.current) -
        resolveOrderRecencyMs(a, orderArrivalTsByOrderId?.current),
    );
  }, [mesas, orderArrivalTsByOrderId]);

  const hasActiveCall = useCallback((mesa: MesaRecord): boolean => {
    const raw = String(mesa?.call_requested_at || '').trim();
    if (!raw) return false;
    const calledAtMs = Date.parse(raw);
    if (!Number.isFinite(calledAtMs)) return false;
    return Date.now() - calledAtMs < CALL_WINDOW_MS;
  }, []);

  const renderItem = useCallback(
    ({ item: mesa }: { item: MesaRecord }) => {
      const occupied = isMesaOccupied(mesa.status);
      const orderId = String(mesa.current_order_id || '').trim();
      const items = orderId ? itemsByOrderId[orderId] || [] : [];
      const notes = String(mesa.orders?.notes || '').trim();
      const isCalling = orderId ? callingOrderIds.has(orderId) : false;
      const callAgain = hasActiveCall(mesa);
      const isMostRecent = Boolean(orderId && mostRecentOrderId === orderId);

      return (
        <View
          style={[
            styles.card,
            occupied ? styles.cardOccupied : styles.cardAvailable,
            isCalling && styles.cardCalling,
          ]}
        >
          {isMostRecent ? (
            <View style={styles.mostRecentBadge}>
              <Ionicons name="flash" size={13} color="#FFFFFF" />
              <Text style={styles.mostRecentBadgeText}>
                {t('labels.mostRecentOrder', 'Pedido más reciente')}
              </Text>
            </View>
          ) : null}
          <View style={styles.cardHeader}>
            <Text style={styles.mesaName}>{mesaDisplayName(mesa)}</Text>
            <View
              style={[
                styles.statusPill,
                occupied ? styles.statusPillOccupied : styles.statusPillAvailable,
              ]}
            >
              <Text style={styles.statusPillText}>
                {occupied ? t('labels.occupied', 'Ocupada') : t('labels.available', 'Disponible')}
              </Text>
            </View>
          </View>

          {occupied ? (
            <>
              {items.length > 0 ? (
                <View style={styles.itemsBlock}>
                  {items.map((item, index) => {
                    const itemKey = String(item.id || `${item.product_id || item.combo_id}-${index}`);
                    return (
                      <View key={itemKey} style={styles.itemRow}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {resolveItemName(item)}
                        </Text>
                        <View style={styles.itemQtyBadge}>
                          <Text style={styles.itemQtyText}>
                            x{Math.max(1, Math.floor(Number(item.quantity || 1)))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : loadingItems ? (
                <View style={styles.itemsLoading}>
                  <ActivityIndicator size="small" color={STOCKY_COLORS.primary700} />
                </View>
              ) : null}

              {notes ? (
                <View style={styles.notesBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#92400E" />
                  <Text style={styles.notesText}>{notes}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => onCallMesa(mesa)}
                disabled={isCalling}
                style={({ pressed }) => [
                  styles.callButton,
                  isCalling && styles.callButtonActive,
                  pressed && styles.callButtonPressed,
                ]}
              >
                {isCalling ? (
                  <Ionicons name="notifications" size={18} color="#FFFFFF" />
                ) : (
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.callButtonText}>
                  {isCalling
                    ? t('toast.callSent.title', '🔔 Llamado enviado')
                    : `🔔 ${callAgain
                      ? t('buttons.callAgain', 'Llamar nuevamente')
                      : t('buttons.call', 'Llamar')}`}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      );
    },
    [itemsByOrderId, callingOrderIds, resolveItemName, onCallMesa, loadingItems, t, hasActiveCall, mostRecentOrderId],
  );

  return (
    <FlatList
      data={occupiedMesas}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      style={styles.flatList}
      contentContainerStyle={styles.body}
      ItemSeparatorComponent={ItemSeparator}
      removeClippedSubviews
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.emptyState}>{t('labels.noTables', 'No hay mesas registradas')}</Text>
        ) : null
      }
      ListFooterComponent={
        loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
          </View>
        ) : null
      }
      renderItem={renderItem}
    />
  );
});

const styles = StyleSheet.create({
  flatList: {
    flexGrow: 0,
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  separator: {
    height: 2,
  },
  loadingBlock: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  mostRecentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F97316',
  },
  mostRecentBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardOccupied: {
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
  },
  cardAvailable: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  cardCalling: {
    borderWidth: 3,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mesaName: {
    flex: 1,
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillOccupied: {
    backgroundColor: '#FEF3C7',
  },
  statusPillAvailable: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  itemsBlock: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemName: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  itemQtyBadge: {
    minWidth: 34,
    height: 26,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
  },
  itemQtyText: {
    color: '#115E59',
    fontSize: 13,
    fontWeight: '800',
  },
  itemsLoading: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesBox: {
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
  notesText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  callButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
  },
  callButtonActive: {
    backgroundColor: '#34D399',
  },
  callButtonPressed: {
    opacity: 0.85,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
