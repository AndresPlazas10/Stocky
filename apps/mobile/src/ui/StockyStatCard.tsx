import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  value: string;
  icon?: IconName;
};

export function StockyStatCard({ label, value, icon = 'stats-chart-outline' }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={STOCKY_COLORS.primary700} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 90,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    gap: 6,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
  },
  label: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
});
