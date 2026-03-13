import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
}>;

function getGradient(variant: Variant) {
  if (variant === 'secondary') {
    return [STOCKY_COLORS.accent500, STOCKY_COLORS.primary700] as const;
  }

  return [STOCKY_COLORS.primary700, STOCKY_COLORS.primary900] as const;
}

export function StockyButton({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: Props) {
  const isDisabled = disabled || loading;

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.ghostButton, isDisabled && styles.disabled]}
      >
        {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        <Text style={styles.ghostText}>{children}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={isDisabled && styles.disabled}>
      <LinearGradient
        colors={getGradient(variant)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.solidButton}
      >
        {loading ? <ActivityIndicator color={STOCKY_COLORS.white} /> : null}
        <Text style={styles.solidText}>{children}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  solidButton: {
    minHeight: 48,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  solidText: {
    color: STOCKY_COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    paddingHorizontal: 14,
  },
  ghostText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.7,
  },
});
