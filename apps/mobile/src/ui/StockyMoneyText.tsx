import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet, Text } from 'react-native';
import { formatCopAmount } from '../services/mesasService';

type Props = {
  value: number | null | undefined;
  style?: StyleProp<TextStyle>;
  codeStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function StockyMoneyText({ value, style, codeStyle, numberOfLines }: Props) {
  const flattened = StyleSheet.flatten(style) || {};
  const baseFontSize = typeof flattened.fontSize === 'number' ? flattened.fontSize : 16;
  const copFontSize = Math.max(10, Math.round(baseFontSize * 0.56));

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {formatCopAmount(value)}
      <Text style={[style, styles.cop, { fontSize: copFontSize }, codeStyle]}> COP</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  cop: {
    color: '#8A94A3',
    fontWeight: '600',
  },
});

