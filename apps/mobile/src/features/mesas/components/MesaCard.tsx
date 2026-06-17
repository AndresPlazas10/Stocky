import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { StatusPill } from './StatusPill';
import { MESA_IN_USE_MESSAGE, mesaDisplayName } from '../utils/mesaHelpers';
import type { MesaRecord } from '../../../services/mesasService';

interface MesaCardProps {
  mesa: MesaRecord;
  occupied: boolean;
  lockedByOther: boolean;
  isBusy?: boolean;
  total?: number;
  productsCount?: number;
  onPress: (mesa: MesaRecord) => void;
  onDeletePress?: (mesa: MesaRecord) => void;
}

export function MesaCard({
  mesa,
  occupied,
  lockedByOther,
  isBusy = false,
  total = 0,
  productsCount = 0,
  onPress,
  onDeletePress,
}: MesaCardProps) {
  return (
    <Pressable
      style={[styles.card, occupied && styles.cardOccupied, lockedByOther && styles.cardLocked]}
      disabled={isBusy}
      onPress={() => onPress(mesa)}
    >
      {onDeletePress ? (
        <Pressable
          style={styles.deleteButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onDeletePress(mesa);
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

      <Text style={styles.title}>{mesaDisplayName(mesa)}</Text>

      {!lockedByOther ? <StatusPill occupied={occupied} lockedByOther={lockedByOther} /> : null}

      {occupied && !lockedByOther ? (
        <View style={styles.occupiedSummary}>
          <View style={styles.divider} />
          <StockyMoneyText value={total} style={styles.metaTotal} />
          <Text style={styles.metaProducts}>
            {productsCount} {productsCount === 1 ? 'producto' : 'productos'}
          </Text>
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
          <Text style={styles.lockText}>{MESA_IN_USE_MESSAGE}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#F5FAF7',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  cardOccupied: {
    backgroundColor: '#F7F9F3',
  },
  cardLocked: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(255, 248, 235, 0.66)',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShell: {
    width: 98,
    height: 98,
    borderRadius: 24,
    backgroundColor: '#DDF5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShellOccupied: {
    backgroundColor: '#F5EDBF',
  },
  title: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  occupiedSummary: {
    width: '100%',
    marginTop: 2,
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  metaTotal: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
  },
  metaProducts: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  lockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  lockScrimStrong: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  lockText: {
    color: '#9A3412',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 14,
    zIndex: 1,
  },
});
