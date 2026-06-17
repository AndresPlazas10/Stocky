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
  orderUnitsByOrderId?: Record<string, number>;
  onMesaPress: (mesa: MesaRecord, meta: { occupied: boolean; lockedByOther: boolean }) => void;
  onDeleteMesa?: (mesa: MesaRecord) => void;
}

export function MesasGrid({
  mesas,
  loading = false,
  actingMesaId,
  canDeleteMesas = false,
  mesaLocksByTableId,
  heldMesaLock,
  contextBusinessId,
  sessionUserId,
  orderUnitsByOrderId,
  onMesaPress,
  onDeleteMesa,
}: MesasGridProps) {
  return (
    <FlatList
      data={mesas}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.mesasPanelBody}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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
      renderItem={({ item: mesa }) => {
        const occupied = isMesaOccupied(mesa.status);
        const isBusy = actingMesaId === mesa.id;
        const mesaLock = mesaLocksByTableId[mesa.id] || null;
        const lockOwnerId = String(mesaLock?.lock_owner_user_id || '').trim();
        const lockToken = String(mesaLock?.lock_token || '').trim();
        const isLocalHeldLock = Boolean(
          heldMesaLock &&
          heldMesaLock.tableId === mesa.id &&
          heldMesaLock.businessId === contextBusinessId,
        );
        const heldLockToken = isLocalHeldLock ? String(heldMesaLock?.lockToken || '').trim() : '';
        const isOwnedByCurrentUser = Boolean(
          lockOwnerId && lockOwnerId === String(sessionUserId || '').trim(),
        );
        const isSameClientLock = Boolean(lockToken && heldLockToken && lockToken === heldLockToken);
        const lockedByOther = Boolean(
          mesaLock && (lockOwnerId ? !isOwnedByCurrentUser : lockToken ? !isSameClientLock : true),
        );
        const total = Number(mesa?.orders?.total || 0);
        const orderId = String(mesa.current_order_id || '').trim();
        const rowUnits = Number(mesa?.order_units);
        const productsCount = orderId
          ? Number(orderUnitsByOrderId?.[orderId] ?? (Number.isFinite(rowUnits) ? rowUnits : 0))
          : 0;

        return (
          <MesaCard
            mesa={mesa}
            occupied={occupied}
            lockedByOther={lockedByOther}
            isBusy={isBusy}
            total={total}
            productsCount={productsCount}
            onPress={(pressedMesa) => onMesaPress(pressedMesa, { occupied, lockedByOther })}
            onDeletePress={canDeleteMesas ? onDeleteMesa : undefined}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
