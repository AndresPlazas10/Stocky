import { StyleSheet, Text, View } from 'react-native';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = {
  ok: boolean;
};

export function StockyStatusPill({ ok }: Props) {
  return (
    <View style={[styles.pill, ok ? styles.okBg : styles.warnBg]}>
      <Text style={[styles.text, ok ? styles.okText : styles.warnText]}>
        {ok ? 'OK' : 'Revisar'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: STOCKY_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
  okBg: {
    backgroundColor: STOCKY_COLORS.successBg,
  },
  okText: {
    color: STOCKY_COLORS.successText,
  },
  warnBg: {
    backgroundColor: STOCKY_COLORS.errorBg,
  },
  warnText: {
    color: STOCKY_COLORS.errorText,
  },
});
