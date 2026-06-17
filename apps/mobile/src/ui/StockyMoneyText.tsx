import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native';
import { formatCopAmount } from '../utils/money';

type Props = {
  value: number | null | undefined;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function StockyMoneyText({ value, style, numberOfLines }: Props) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {formatCopAmount(value)}
    </Text>
  );
}
