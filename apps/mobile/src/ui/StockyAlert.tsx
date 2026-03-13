import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Tone = 'info' | 'success' | 'error';

type Props = PropsWithChildren<{
  tone?: Tone;
}>;

const toneStyles: Record<Tone, { bg: string; text: string; border: string }> = {
  info: {
    bg: 'rgba(102, 165, 173, 0.16)',
    text: STOCKY_COLORS.primary900,
    border: STOCKY_COLORS.borderSoft,
  },
  success: {
    bg: STOCKY_COLORS.successBg,
    text: STOCKY_COLORS.successText,
    border: 'rgba(22, 101, 52, 0.24)',
  },
  error: {
    bg: STOCKY_COLORS.errorBg,
    text: STOCKY_COLORS.errorText,
    border: 'rgba(153, 27, 27, 0.24)',
  },
};

export function StockyAlert({ tone = 'info', children }: Props) {
  const config = toneStyles[tone];

  return (
    <View style={[styles.base, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.text, { color: config.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: STOCKY_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
