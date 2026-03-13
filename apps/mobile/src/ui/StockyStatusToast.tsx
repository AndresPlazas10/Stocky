import { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  durationMs?: number;
  onClose: () => void;
};

export function StockyStatusToast({
  visible,
  title,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  durationMs = 1000,
  onClose,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) onClose();
    });
    return () => {
      anim.stop();
    };
  }, [durationMs, onClose, progress, visible]);

  const lineWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        {Platform.OS === 'android' ? (
          <View style={styles.backdropDim} />
        ) : (
          <BlurView
            style={StyleSheet.absoluteFillObject}
            tint="dark"
            intensity={22}
            experimentalBlurMethod="dimezisBlurView"
          />
        )}
        <View style={styles.cardWrap}>
          {Platform.OS === 'android' ? (
            <View style={styles.cardBackdrop} />
          ) : (
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="dark"
              intensity={20}
              experimentalBlurMethod="dimezisBlurView"
            />
          )}
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark" size={20} color="#E2E8F0" />
            </View>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={16} color="#F8FAFC" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{primaryLabel}</Text>
                <Text style={styles.detailValue}>{primaryValue}</Text>
              </View>
              {secondaryLabel && secondaryValue ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{secondaryLabel}</Text>
                  <Text style={styles.detailValue}>{secondaryValue}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: lineWidth }]} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  cardBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
  },
  card: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.4)',
    alignSelf: 'center',
  },
  title: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailCard: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: '#CBD5F5',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(226, 232, 240, 0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
});
