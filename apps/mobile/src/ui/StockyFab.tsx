import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
};

export function StockyFab({ label, icon = 'add', onPress, disabled = false }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Ionicons name={icon} size={20} color={STOCKY_COLORS.white} />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 16,
    bottom: 20,
  },
  button: {
    minHeight: 54,
    borderRadius: STOCKY_RADIUS.lg,
    backgroundColor: STOCKY_COLORS.primary700,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#003B46',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  text: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
});
