import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
  type: ToastType;
  title: string;
  message?: string;
  ctaText?: string;
  durationMs?: number;
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

export function StockyToast({
  visible,
  type,
  title,
  message,
  ctaText,
  durationMs = 2500,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const translateY = useState(() => new Animated.Value(100))[0];
  const opacity = useState(() => new Animated.Value(0))[0];
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }

    progress.setValue(0);
    translateY.setValue(100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    });
    let cancelled = false;
    anim.start(({ finished }) => {
      if (finished && !cancelled) onCloseRef.current();
    });
    return () => {
      cancelled = true;
      anim.stop();
    };
  }, [durationMs, progress, translateY, opacity, visible]);

  const scaleX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const config = TYPE_CONFIG[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: Math.max(insets.bottom, 16) + 16,
          opacity,
          transform: [{ translateY }],
        },
      ]}
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
            style={[
              styles.progressFill,
              { backgroundColor: config.progressColor, transform: [{ scaleX }] },
            ]}
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
