import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { MesaCard } from './MesaCard';
import { isMesaOccupied } from '../utils/mesaHelpers';
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
  selectedMesaId?: string | number | null;
  loading?: boolean;
  actingMesaId?: string | null;
  canDeleteMesas?: boolean;
  mesaLocksByTableId: Record<string, MesaEditLock>;
  heldMesaLock: HeldMesaLock | null;
  contextBusinessId?: string | null;
  sessionUserId?: string;
  onMesaPress: (mesa: MesaRecord, meta: { occupied: boolean; lockedByOther: boolean }) => void;
  onDeleteMesa?: (mesa: MesaRecord) => void;
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
      const isOwnedByCurrentUser = Boolean(
        lockOwnerId && lockOwnerId === normalizedSessionUserId,
      );
      const isSameClientLock = Boolean(lockToken && heldLockToken && lockToken === heldLockToken);
      const lockedByOther = Boolean(
        mesaLock && (lockOwnerId ? !isOwnedByCurrentUser : lockToken ? !isSameClientLock : true),
      );
      const total = Number(mesa?.orders?.total || 0);

      map.set(mesa.id, { occupied, lockedByOther, total, isBusy });
    }
    return map;
  }, [mesas, actingMesaId, mesaLocksByTableId, heldMesaLock, contextBusinessId, sessionUserId]);

  const renderItem = useCallback(
    ({ item: mesa }: { item: MesaRecord }) => {
      const meta = mesaMetaMap.get(mesa.id);
      const occupied = meta?.occupied ?? false;
      const lockedByOther = meta?.lockedByOther ?? false;
      const total = meta?.total ?? 0;
      const isBusy = meta?.isBusy ?? false;

      return (
        <MesaCard
          mesa={mesa}
          occupied={occupied}
          lockedByOther={lockedByOther}
          isBusy={isBusy}
          total={total}
          onPress={(pressedMesa) => onMesaPress(pressedMesa, { occupied, lockedByOther })}
          onDeletePress={canDeleteMesas ? onDeleteMesa : undefined}
        />
      );
    },
    [mesaMetaMap, canDeleteMesas, onDeleteMesa, onMesaPress],
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
