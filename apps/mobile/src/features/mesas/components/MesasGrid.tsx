import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { MesaCard } from './MesaCard';
import { isMesaOccupied, CALL_WINDOW_MS } from '../utils/mesaHelpers';
import type { MesaEditLock, MesaRecord } from '../../../services/mesasService';

type HeldMesaLock = {
  tableId: string;
  businessId: string;
  lockToken: string | null;
};

type MesaMeta = {
  occupied: boolean;
  lockedByOther: boolean;
  total: number;
  isBusy: boolean;
};

interface MesasGridProps {
  mesas: MesaRecord[];
  loading?: boolean;
  actingMesaId?: string | null;
  canDeleteMesas?: boolean;
  mesaLocksByTableId: Record<string, MesaEditLock>;
  heldMesaLock: HeldMesaLock | null;
  contextBusinessId?: string | null;
  sessionUserId?: string;
  onMesaPress: (mesa: MesaRecord, meta: { occupied: boolean; lockedByOther: boolean }) => void;
  onDeleteMesa?: (mesa: MesaRecord) => void;
  onDismissCall?: (mesa: MesaRecord) => void;
}

const ItemSeparator = () => <View style={styles.separator} />;

const keyExtractor = (item: MesaRecord) => item.id;

export const MesasGrid = React.memo(function MesasGrid({
  mesas,
  loading = false,
  actingMesaId,
  canDeleteMesas = false,
  mesaLocksByTableId,
  heldMesaLock,
  contextBusinessId,
  sessionUserId,
  onMesaPress,
  onDeleteMesa,
  onDismissCall,
}: MesasGridProps) {
  const mesaMetaMap = useMemo(() => {
    const map = new Map<string, MesaMeta>();
    const normalizedSessionUserId = String(sessionUserId || '').trim();
    const normalizedHeldTableId = heldMesaLock?.tableId || '';
    const normalizedHeldBusinessId = heldMesaLock?.businessId || '';
    const normalizedHeldToken = String(heldMesaLock?.lockToken || '').trim();
    const isHeldLockRelevant = normalizedHeldBusinessId === (contextBusinessId || '');

    for (const mesa of mesas) {
      const occupied = isMesaOccupied(mesa.status);
      const isBusy = actingMesaId === mesa.id;
      const mesaLock = mesaLocksByTableId[mesa.id] || null;
      const lockOwnerId = String(mesaLock?.lock_owner_user_id || '').trim();
      const lockToken = String(mesaLock?.lock_token || '').trim();
      const isLocalHeldLock = isHeldLockRelevant && normalizedHeldTableId === mesa.id;
      const heldLockToken = isLocalHeldLock ? normalizedHeldToken : '';
      const isOwnedByCurrentUser = Boolean(lockOwnerId && lockOwnerId === normalizedSessionUserId);
      const isSameClientLock = Boolean(lockToken && heldLockToken && lockToken === heldLockToken);
      const lockedByOther = Boolean(
        mesaLock && (lockOwnerId ? !isOwnedByCurrentUser : lockToken ? !isSameClientLock : true),
      );
      const total = Number(mesa?.orders?.total || 0);

      map.set(mesa.id, { occupied, lockedByOther, total, isBusy });
    }
    return map;
  }, [mesas, actingMesaId, mesaLocksByTableId, heldMesaLock, contextBusinessId, sessionUserId]);

  const isCallActive = useCallback((mesa: MesaRecord): boolean => {
    const raw = String(mesa?.call_requested_at || '').trim();
    if (!raw) return false;
    const calledAtMs = Date.parse(raw);
    if (!Number.isFinite(calledAtMs)) return false;
    return Date.now() - calledAtMs < CALL_WINDOW_MS;
  }, []);

  const renderItem = useCallback(
    ({ item: mesa }: { item: MesaRecord }) => {
      const meta = mesaMetaMap.get(mesa.id);
      const occupied = meta?.occupied ?? false;
      const lockedByOther = meta?.lockedByOther ?? false;
      const total = meta?.total ?? 0;
      const isBusy = meta?.isBusy ?? false;
      const callActive = isCallActive(mesa);

      return (
        <MesaCard
          mesa={mesa}
          occupied={occupied}
          lockedByOther={lockedByOther}
          isBusy={isBusy}
          total={total}
          callActive={callActive}
          onPress={(pressedMesa) => onMesaPress(pressedMesa, { occupied, lockedByOther })}
          onDeletePress={canDeleteMesas ? onDeleteMesa : undefined}
          onDismissCall={onDismissCall}
        />
      );
    },
    [mesaMetaMap, canDeleteMesas, onDeleteMesa, onMesaPress, onDismissCall, isCallActive],
  );

  return (
    <FlatList
      data={mesas}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      style={styles.flatList}
      contentContainerStyle={styles.mesasPanelBody}
      ItemSeparatorComponent={ItemSeparator}
      removeClippedSubviews
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.emptyState}>No hay mesas registradas para este negocio.</Text>
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
  separator: {
    height: 14,
  },
  mesasPanelBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
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
});
