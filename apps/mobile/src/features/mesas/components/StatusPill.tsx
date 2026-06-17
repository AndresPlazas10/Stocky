import { StyleSheet, Text, View } from 'react-native';

interface StatusPillProps {
  occupied: boolean;
  lockedByOther: boolean;
}

export function StatusPill({ occupied, lockedByOther }: StatusPillProps) {
  const locked = lockedByOther;
  return (
    <View
      style={[styles.pill, locked ? styles.locked : occupied ? styles.occupied : styles.available]}
    >
      <View
        style={[
          styles.dot,
          locked ? styles.dotLocked : occupied ? styles.dotOccupied : styles.dotAvailable,
        ]}
      />
      <Text
        style={[
          styles.text,
          locked ? styles.textLocked : occupied ? styles.textOccupied : styles.textAvailable,
        ]}
      >
        {locked ? 'En uso' : occupied ? 'Ocupada' : 'Disponible'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
  occupied: {
    backgroundColor: '#FACC15',
  },
  textOccupied: {
    color: '#6B7280',
  },
  available: {
    backgroundColor: '#0AC946',
  },
  textAvailable: {
    color: '#E9FFEF',
  },
  locked: {
    backgroundColor: '#FDBA74',
  },
  textLocked: {
    color: '#7C2D12',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  dotOccupied: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  dotAvailable: {
    backgroundColor: '#7CC74D',
    borderColor: '#65A30D',
  },
  dotLocked: {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
  },
});
