import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { StatusPill } from './StatusPill';

interface MesaCardProps {
  mesaId: string;
  displayName: string;
  occupied: boolean;
  isBusy: boolean;
  lockedByOther: boolean;
  total: number;
  productsCount: number;
  canDelete: boolean;
  lockMessage: string;
  onPress: () => void;
  onDelete: () => void;
}

export function MesaCard({
  mesaId,
  displayName,
  occupied,
  isBusy,
  lockedByOther,
  total,
  productsCount,
  canDelete,
  lockMessage,
  onPress,
  onDelete,
}: MesaCardProps) {
  return (
    <Pressable
      key={mesaId}
      style={[styles.card, occupied && styles.cardOccupied, lockedByOther && styles.cardLocked]}
      disabled={isBusy}
      onPress={onPress}
    >
      {canDelete ? (
        <Pressable
          style={styles.deleteButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onDelete();
          }}
          hitSlop={8}
          disabled={isBusy}
        >
          <Ionicons name="trash-outline" size={24} color="#111827" />
        </Pressable>
      ) : null}

      <View style={[styles.iconShell, occupied && styles.iconShellOccupied]}>
        <Ionicons name="layers-outline" size={54} color={occupied ? '#CA8A04' : '#00A63E'} />
      </View>

      <Text style={styles.title}>{displayName}</Text>
      {!lockedByOther ? <StatusPill occupied={occupied} lockedByOther={lockedByOther} /> : null}
      {occupied && !lockedByOther ? (
        <View style={styles.occupiedSummary}>
          <View style={styles.divider} />
          <StockyMoneyText value={total} style={styles.metaTotal} />
          <Text style={styles.metaProducts}>{productsCount} {productsCount === 1 ? 'producto' : 'productos'}</Text>
        </View>
      ) : null}

      {lockedByOther ? (
        <View pointerEvents="none" style={styles.lockOverlay}>
          {Platform.OS === 'android' ? (
            <View style={styles.lockScrimStrong} />
          ) : (
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="light"
              intensity={24}
              experimentalBlurMethod="dimezisBlurView"
            />
          )}
          <View style={styles.lockScrim} />
          <Text style={styles.lockText}>{lockMessage}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '48%',
    position: 'relative',
    overflow: 'hidden',
  },
  cardOccupied: {
    borderColor: '#FCD34D',
  },
  cardLocked: {
    borderColor: '#FDBA74',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(243,244,246,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShell: {
    marginBottom: 10,
    paddingTop: 8,
  },
  iconShellOccupied: {
    opacity: 0.9,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  occupiedSummary: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  metaTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  metaProducts: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockScrimStrong: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(226,232,240,0.92)',
  },
  lockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  lockText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7C2D12',
    textAlign: 'center',
    paddingHorizontal: 12,
    zIndex: 1,
  },
});
