import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = {
  visible: boolean;
  label?: string;
  detail?: string | null;
};

export function StockyProcessingOverlay({
  visible,
  label = 'Procesando...',
  detail,
}: Props) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear, visible]);

  const scrimOpacity = appear;
  const cardOpacity = appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const cardScale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const cardTranslateY = appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]}>
          <BlurView
            style={StyleSheet.absoluteFillObject}
            tint="dark"
            intensity={24}
            experimentalBlurMethod="dimezisBlurView"
          />
          <View style={styles.scrim} />
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
            },
          ]}
        >
          <ActivityIndicator size="large" color={STOCKY_COLORS.primary900} />
          <Text style={styles.label}>{label}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 34, 37, 0.22)',
  },
  card: {
    minWidth: 218,
    borderRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 7,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  label: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  detail: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
