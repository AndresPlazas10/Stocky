import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { perfDurationMs, perfMark } from '../utils/perfAudit';

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
  instantOpen?: boolean;
  perfTag?: string;
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const MODAL_HEIGHT_REDUCTION_FACTOR = 0.95;

function scaleModalHeightValue<T>(value: T): T {
  if (typeof value === 'number') {
    return Math.max(0, Math.round(value * MODAL_HEIGHT_REDUCTION_FACTOR)) as T;
  }

  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const parsedValue = Number.parseFloat(value);
    if (Number.isFinite(parsedValue)) {
      const scaled = (parsedValue * MODAL_HEIGHT_REDUCTION_FACTOR)
        .toFixed(2)
        .replace(/\.?0+$/, '');
      return `${scaled}%` as T;
    }
  }

  return value;
}

export function StockyModal({
  visible,
  title,
  onClose,
  footer,
  children,
  backdropVariant = 'blur',
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
  animationDurationMs = 220,
  entryEffect = 'none',
  animationScaleFrom,
  bodyFlex,
  instantOpen = false,
  perfTag,
}: Props) {
  const isCentered = layout === 'centered';
  const centeredShift = Math.max(0, centeredOffsetY);
  const effectiveBackdrop =
    backdropVariant === 'blur' && Platform.OS === 'android' ? 'dim' : backdropVariant;
  const openDuration = Math.max(
    140,
    Math.min(animationDurationMs + (modalAnimationType === 'slide' ? 30 : 0), 280),
  );
  const closeDuration = Math.max(120, Math.min(animationDurationMs - 20, 240));
  const openEasing = useMemo(
    () => (animationStyle === 'web' ? Easing.out(Easing.cubic) : Easing.out(Easing.exp)),
    [animationStyle],
  );
  const closeEasing = useMemo(
    () => (animationStyle === 'web' ? Easing.inOut(Easing.cubic) : Easing.in(Easing.cubic)),
    [animationStyle],
  );
  const resolvedScaleFrom = typeof animationScaleFrom === 'number'
    ? Math.min(1, Math.max(0.94, animationScaleFrom))
    : (modalAnimationType === 'fade' ? 0.985 : 1);
  const initialTranslateY = useMemo(() => {
    if (modalAnimationType === 'slide') return isCentered ? 24 : 32;
    if (modalAnimationType === 'fade') return isCentered ? 10 : 14;
    return 0;
  }, [isCentered, modalAnimationType]);
  const appear = useRef(new Animated.Value(0)).current;
  const [renderVisible, setRenderVisible] = useState(visible);
  const visibilityAnimationIdRef = useRef(0);
  const modalOpenStartedAtRef = useRef(0);
  const openPaintLoggedRef = useRef(false);
  const contentReadyLoggedRef = useRef(false);
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
  const adjustedSheetStyle = useMemo(() => {
    const flattened = StyleSheet.flatten(sheetStyle);
    if (!flattened) return undefined;

    const adjusted: ViewStyle = { ...flattened };

    if (adjusted.height != null) {
      adjusted.height = scaleModalHeightValue(adjusted.height);
    }
    if (adjusted.maxHeight != null) {
      adjusted.maxHeight = scaleModalHeightValue(adjusted.maxHeight);
    }
    if (adjusted.minHeight != null) {
      adjusted.minHeight = scaleModalHeightValue(adjusted.minHeight);
    }

    return adjusted;
  }, [sheetStyle]);

  useEffect(() => {
    if (visible) setRenderVisible(true);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    modalOpenStartedAtRef.current = Date.now();
    openPaintLoggedRef.current = false;
    contentReadyLoggedRef.current = false;
    perfMark('modal_open_start', {
      modal: perfTag || title || 'untagged',
      animation: modalAnimationType,
      layout,
      backdrop: effectiveBackdrop,
      deferContent,
      instantOpen,
    });
  }, [deferContent, effectiveBackdrop, instantOpen, layout, modalAnimationType, perfTag, title, visible]);

  useEffect(() => {
    if (!renderVisible) return;
    visibilityAnimationIdRef.current += 1;
    const animationId = visibilityAnimationIdRef.current;

    appear.stopAnimation();

    if (visible) {
      if (instantOpen) {
        appear.setValue(1);
        if (!openPaintLoggedRef.current) {
          openPaintLoggedRef.current = true;
          perfMark('modal_open_painted', {
            modal: perfTag || title || 'untagged',
            openMs: perfDurationMs(modalOpenStartedAtRef.current),
            mode: 'instant',
          });
        }
      } else {
        appear.setValue(0);
        Animated.timing(appear, {
          toValue: 1,
          duration: openDuration,
          easing: openEasing,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || openPaintLoggedRef.current) return;
          openPaintLoggedRef.current = true;
          perfMark('modal_open_painted', {
            modal: perfTag || title || 'untagged',
            openMs: perfDurationMs(modalOpenStartedAtRef.current),
            mode: 'animated',
          });
        });
      }
      return;
    }

    Animated.timing(appear, {
      toValue: 0,
      duration: closeDuration,
      easing: closeEasing,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (visibilityAnimationIdRef.current !== animationId) return;
      perfMark('modal_close_complete', {
        modal: perfTag || title || 'untagged',
        closeMs: closeDuration,
      });
      setRenderVisible(false);
    });
  }, [
    appear,
    closeDuration,
    closeEasing,
    openDuration,
    openEasing,
    instantOpen,
    perfTag,
    renderVisible,
    title,
    visible,
  ]);

  useEffect(() => {
    if (!deferContent || instantOpen) {
      setContentReady(true);
      contentOpacity.setValue(1);
      return;
    }

    if (!renderVisible) {
      setContentReady(false);
      contentOpacity.setValue(0);
      return;
    }

    if (!visible) {
      return;
    }

    setContentReady(false);
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) setContentReady(true);
    });

    return () => {
      cancelled = true;
      (handle as { cancel?: () => void }).cancel?.();
    };
  }, [deferContent, instantOpen, renderVisible, visible]);

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

  useEffect(() => {
    if (!visible || !renderVisible || !contentReady || contentReadyLoggedRef.current) return;
    contentReadyLoggedRef.current = true;
    perfMark('modal_content_ready', {
      modal: perfTag || title || 'untagged',
      readyMs: perfDurationMs(modalOpenStartedAtRef.current),
      deferContent,
    });
  }, [contentReady, deferContent, perfTag, renderVisible, title, visible]);

  const scrimOpacity = appear;
  const sheetOpacity = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const sheetTranslateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [initialTranslateY, 0],
  });
  const sheetScale = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [resolvedScaleFrom, 1],
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
      visible={renderVisible}
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
            adjustedSheetStyle,
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
    maxHeight: '87%',
    overflow: 'hidden',
  },
  centeredSheet: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    borderRadius: STOCKY_RADIUS.lg,
  },
  centeredSheetFlex: {
    minHeight: '65%',
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
    minHeight: '55%',
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
});
