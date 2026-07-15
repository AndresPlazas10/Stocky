import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnUI,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastSound } from '../hooks/useToastSound';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
  type: ToastType;
  title: string;
  message?: string;
  ctaText?: string;
  durationMs?: number;
  sound?: boolean;
};

type Props = ToastOptions & {
  visible: boolean;
  onClose: () => void;
};

const TYPE_CONFIG: Record<
  ToastType,
  { iconName: keyof typeof Ionicons.glyphMap; iconBg: string; progressColor: string }
> = {
  success: { iconName: 'checkmark', iconBg: '#22C55E', progressColor: '#22C55E' },
  error: { iconName: 'close', iconBg: '#EF4444', progressColor: '#EF4444' },
  warning: { iconName: 'warning', iconBg: '#F59E0B', progressColor: '#F59E0B' },
  info: { iconName: 'information', iconBg: '#3B82F6', progressColor: '#3B82F6' },
};

const SPRING_CONFIG = { damping: 12, stiffness: 80, mass: 0.8 };

export function StockyToast({
  visible,
  type,
  title,
  message,
  ctaText,
  durationMs = 2500,
  sound = true,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  const { playSound } = useToastSound();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(progress);
      progress.value = 0;
      translateY.value = withTiming(-100, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      return;
    }

    if (sound) {
      playSound(type);
    }

    runOnUI(() => {
      'worklet';
      progress.value = 0;
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });
      progress.value = withTiming(
        1,
        { duration: durationMs, easing: Easing.linear },
        (finished) => {
          if (finished) {
            runOnJS(onCloseRef.current)();
          }
        },
      );
    })();
  }, [visible, durationMs, progress, translateY, opacity, sound, type, playSound]);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const config = TYPE_CONFIG[type];
  const topOffset = insets.top + 16;

  return (
    <Animated.View
      style={[styles.container, { top: topOffset }, containerStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
            <Ionicons name={config.iconName} size={18} color="#FFFFFF" />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {ctaText ? <Text style={styles.cta}>{ctaText}</Text> : null}
          </View>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { backgroundColor: config.progressColor }, progressStyle]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 18,
  },
  cta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#F1F5F9',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left',
  },
});
