import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  rightSlot?: ReactNode;
  onPress?: () => void;
};

export function StockyListCard({ title, subtitle, meta, rightSlot, onPress }: Props) {
  const Component = onPress ? Pressable : View;

  return (
    <Component onPress={onPress} style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.right}>
        {rightSlot}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={STOCKY_COLORS.textMuted} /> : null}
      </View>
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
});
