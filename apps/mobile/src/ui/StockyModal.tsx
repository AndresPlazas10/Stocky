import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = PropsWithChildren<{
  visible: boolean;
  title?: string;
  onClose: () => void;
  footer?: ReactNode;
  backdropVariant?: 'dim' | 'blur';
  layout?: 'sheet' | 'centered';
  centeredOffsetY?: number;
  modalAnimationType?: 'none' | 'slide' | 'fade';
  headerSlot?: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  deferContent?: boolean;
  deferFallback?: ReactNode;
  deferBehavior?: 'unmount' | 'hide';
  animationStyle?: 'default' | 'web';
  animationDurationMs?: number;
  entryEffect?: 'none' | 'blur';
  animationScaleFrom?: number;
  bodyFlex?: boolean;
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function StockyModal({
  visible,
  title,
  onClose,
  footer,
  children,
  backdropVariant = 'dim',
  layout = 'sheet',
  centeredOffsetY = 0,
  modalAnimationType = 'fade',
  headerSlot,
  sheetStyle,
  contentStyle,
  contentContainerStyle,
  footerStyle,
  deferContent = false,
  deferFallback,
  deferBehavior = 'unmount',
  animationStyle = 'web',
  animationDurationMs = 260,
  entryEffect = 'none',
  animationScaleFrom,
  bodyFlex,
}: Props) {
  const isCentered = layout === 'centered';
  const centeredShift = Math.max(0, centeredOffsetY);
  const effectiveBackdrop =
    backdropVariant === 'blur' && Platform.OS === 'android' ? 'dim' : backdropVariant;
  const animationPreset =
    modalAnimationType === 'fade' ? 'fade' : modalAnimationType === 'slide' ? 'slide' : 'pop';
  const entryDistance = animationStyle === 'web'
    ? 0
    : (isCentered ? 14 : animationPreset === 'slide' ? 30 : 16);
  const resolvedScaleFrom = typeof animationScaleFrom === 'number'
    ? Math.min(1, Math.max(0.9, animationScaleFrom))
    : (animationStyle === 'web' ? 1 : (animationPreset === 'slide' ? 0.98 : 0.95));
  const entryScale = resolvedScaleFrom;
  const appear = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(!deferContent);
  const contentOpacity = useRef(new Animated.Value(deferContent ? 0 : 1)).current;
  const shouldHideContent = deferContent && deferBehavior === 'hide';
  const shouldUnmountContent = deferContent && deferBehavior === 'unmount';
  const wrapperOpacity = shouldHideContent ? contentOpacity : 1;
  const wrapperPointerEvents = shouldHideContent && !contentReady ? 'none' : 'auto';
  const shouldFlexBody = typeof bodyFlex === 'boolean' ? bodyFlex : !isCentered;
  const wrapperLayoutStyle = shouldFlexBody ? styles.sheetBody : undefined;
  const sheetFlexStyle = shouldFlexBody
    ? (isCentered ? styles.centeredSheetFlex : styles.sheetFlex)
    : undefined;

  useEffect(() => {
    if (!visible) return;

    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: animationDurationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animationDurationMs, appear, visible]);

  useEffect(() => {
    if (!deferContent) {
      setContentReady(true);
      contentOpacity.setValue(1);
      return;
    }

    if (!visible) {
      setContentReady(false);
      contentOpacity.setValue(0);
      return;
    }

    setContentReady(false);
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) setContentReady(true);
    });

    return () => {
      cancelled = true;
      if (handle && typeof (handle as { cancel?: () => void }).cancel === 'function') {
        (handle as { cancel?: () => void }).cancel();
      }
    };
  }, [deferContent, visible]);

  useEffect(() => {
    if (!deferContent) return;
    if (!contentReady) {
      contentOpacity.setValue(0);
      return;
    }

    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity, contentReady, deferContent]);

  const scrimOpacity = appear;
  const sheetOpacity = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [animationStyle === 'web' ? 0 : 0.6, 1],
  });
  const sheetTranslateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [entryDistance, 0],
  });
  const sheetScale = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [entryScale, 1],
  });
  const blurOverlayOpacity = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
    >
      <View style={[styles.overlay, isCentered ? styles.overlayCentered : styles.overlaySheet]}>
        {effectiveBackdrop === 'blur' ? (
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]}>
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="dark"
              intensity={26}
              experimentalBlurMethod="dimezisBlurView"
            />
          </Animated.View>
        ) : null}
        <AnimatedPressable
          style={[
            styles.scrim,
            effectiveBackdrop === 'blur' ? styles.scrimBlur : styles.scrimDim,
            { opacity: scrimOpacity },
          ]}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.sheet,
            isCentered && styles.centeredSheet,
            Platform.OS === 'android' && styles.sheetAndroid,
            {
              opacity: sheetOpacity,
              transform: [
                ...(isCentered && centeredShift > 0 ? [{ translateY: -centeredShift }] : []),
                { translateY: sheetTranslateY },
                { scale: sheetScale },
              ],
            },
            sheetFlexStyle,
            sheetStyle,
          ]}
        >
          <Animated.View
            style={[wrapperLayoutStyle, { opacity: wrapperOpacity }]}
            pointerEvents={wrapperPointerEvents}
          >
            {headerSlot ? (
              <View style={styles.customHeader}>{headerSlot}</View>
            ) : (
              <View style={styles.header}>
                <Text style={styles.title}>{title || 'Detalle'}</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={22} color={STOCKY_COLORS.textSecondary} />
                </Pressable>
              </View>
            )}

            {shouldFlexBody ? (
              <ScrollView
                style={[styles.content, contentStyle]}
                contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
              >
                {shouldUnmountContent && !contentReady ? (deferFallback ?? null) : children}
              </ScrollView>
            ) : (
              <View style={[styles.contentContainer, contentStyle, contentContainerStyle]}>
                {shouldUnmountContent && !contentReady ? (deferFallback ?? null) : children}
              </View>
            )}

            {footer ? <View style={[styles.footer, footerStyle]}>{footer}</View> : null}
          </Animated.View>

          {entryEffect === 'blur' ? (
            <Animated.View pointerEvents="none" style={[styles.sheetBlurOverlay, { opacity: blurOverlayOpacity }]}>
              <BlurView
                style={StyleSheet.absoluteFillObject}
                tint="light"
                intensity={24}
                experimentalBlurMethod="dimezisBlurView"
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheetBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: STOCKY_RADIUS.lg,
  },
  customHeader: {
    borderBottomWidth: 1,
    borderBottomColor: STOCKY_COLORS.borderSoft,
  },
  overlaySheet: {
    justifyContent: 'flex-end',
  },
  overlayCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimDim: {
    backgroundColor: 'rgba(2, 34, 37, 0.38)',
  },
  scrimBlur: {
    backgroundColor: 'rgba(2, 34, 37, 0.20)',
  },
  sheet: {
    backgroundColor: STOCKY_COLORS.surface,
    borderTopLeftRadius: STOCKY_RADIUS.lg,
    borderTopRightRadius: STOCKY_RADIUS.lg,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  centeredSheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: STOCKY_RADIUS.lg,
  },
  centeredSheetFlex: {
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: STOCKY_COLORS.borderSoft,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: STOCKY_COLORS.textPrimary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
  },
  sheetAndroid: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowColor: 'transparent',
    elevation: 0,
  },
  sheetFlex: {
    minHeight: '60%',
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
});
