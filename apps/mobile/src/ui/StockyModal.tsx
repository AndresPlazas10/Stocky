import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type Props = PropsWithChildren<{
  visible: boolean;
  title?: string;
  onClose: () => void;
  footer?: ReactNode;
  backdropVariant?: 'dim' | 'blur';
  layout?: 'sheet' | 'centered';
  centeredOffsetY?: number;
  headerSlot?: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  deferContent?: boolean;
  deferFallback?: ReactNode;
  deferBehavior?: 'unmount' | 'hide';
  bodyFlex?: boolean;
  perfTag?: string;
  dismissable?: boolean;
  hideCloseButton?: boolean;
  entryAnimation?: boolean;
}>;

const MODAL_HEIGHT_REDUCTION_FACTOR = 0.95;

function scaleModalHeightValue<T>(value: T): T {
  if (typeof value === 'number') {
    return Math.max(0, Math.round(value * MODAL_HEIGHT_REDUCTION_FACTOR)) as T;
  }

  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const parsedValue = Number.parseFloat(value);
    if (Number.isFinite(parsedValue)) {
      const scaled = (parsedValue * MODAL_HEIGHT_REDUCTION_FACTOR).toFixed(2).replace(/\.?0+$/, '');
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
  headerSlot,
  sheetStyle,
  contentStyle,
  contentContainerStyle,
  footerStyle,
  deferContent = false,
  deferFallback,
  deferBehavior = 'unmount',
  bodyFlex,
  dismissable = false,
  hideCloseButton = false,
  entryAnimation = true,
}: Props) {
  const isCentered = layout === 'centered';
  const centeredShift = Math.max(0, centeredOffsetY);
  const effectiveBackdrop = backdropVariant === 'blur' ? 'dim' : backdropVariant;

  const [renderVisible, setRenderVisible] = useState(visible);
  const [contentReady, setContentReady] = useState(!deferContent);
  const shouldUnmountContent = deferContent && deferBehavior === 'unmount';
  const shouldHideContent = deferContent && deferBehavior === 'hide';
  const wrapperPointerEvents = shouldHideContent && !contentReady ? 'none' : 'auto';
  const shouldFlexBody = typeof bodyFlex === 'boolean' ? bodyFlex : !isCentered;
  const wrapperLayoutStyle = shouldFlexBody ? styles.sheetBody : undefined;
  const sheetFlexStyle = shouldFlexBody
    ? isCentered
      ? styles.centeredSheetFlex
      : styles.sheetFlex
    : undefined;

  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!entryAnimation || !visible) return;
    appearAnim.setValue(0);
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appearAnim, entryAnimation, visible]);

  const sheetAnimatedStyle = entryAnimation
    ? {
        opacity: appearAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
        transform: [
          { translateY: appearAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) },
          { scale: appearAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
        ],
      }
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
    setRenderVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (!deferContent) {
      setContentReady(true);
      return;
    }

    if (!renderVisible) {
      setContentReady(false);
      return;
    }

    if (!visible) return;

    if (!contentReady) {
      let cancelled = false;
      const frameId = requestAnimationFrame(() => {
        if (!cancelled) setContentReady(true);
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(frameId);
      };
    }
  }, [deferContent, renderVisible, visible, contentReady]);

  return (
    <Modal
      animationType="none"
      transparent
      visible={renderVisible}
      onRequestClose={dismissable ? onClose : undefined}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS === 'android'}
    >
      <View style={[styles.overlay, isCentered ? styles.overlayCentered : styles.overlaySheet]}>
        <View style={[StyleSheet.absoluteFillObject, styles.scrimVisible]}>
          <Pressable
            style={[styles.scrim, styles.scrimDim]}
            onPress={dismissable ? onClose : undefined}
          />
        </View>
        {entryAnimation ? (
          <Animated.View
            style={[
              styles.sheet,
              isCentered && styles.centeredSheet,
              Platform.OS === 'android' && styles.sheetAndroid,
              centeredShift > 0 ? { marginTop: -centeredShift } : undefined,
              sheetFlexStyle,
              adjustedSheetStyle,
              sheetAnimatedStyle,
            ]}
          >
            <View style={wrapperLayoutStyle} pointerEvents={wrapperPointerEvents}>
              {headerSlot ? (
                <View style={styles.customHeader}>
                  {headerSlot}
                  {!hideCloseButton ? (
                    <Pressable onPress={onClose} style={styles.headerCloseOverlay}>
                      <Ionicons name="close" size={22} color={STOCKY_COLORS.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
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
            </View>
          </Animated.View>
        ) : (
          <View
            style={[
              styles.sheet,
              isCentered && styles.centeredSheet,
              Platform.OS === 'android' && styles.sheetAndroid,
              centeredShift > 0 ? { marginTop: -centeredShift } : undefined,
              sheetFlexStyle,
              adjustedSheetStyle,
            ]}
          >
            <View style={wrapperLayoutStyle} pointerEvents={wrapperPointerEvents}>
              {headerSlot ? (
                <View style={styles.customHeader}>
                  {headerSlot}
                  {!hideCloseButton ? (
                    <Pressable onPress={onClose} style={styles.headerCloseOverlay}>
                      <Ionicons name="close" size={22} color={STOCKY_COLORS.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
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
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  customHeader: {
    borderBottomWidth: 1,
    borderBottomColor: STOCKY_COLORS.borderSoft,
  },
  headerCloseOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  scrimVisible: {
    opacity: 1,
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
