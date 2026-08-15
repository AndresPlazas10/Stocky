import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastContext } from '../hooks/useToastContext';
import { StockyToast } from './StockyToast';

export function ToastHost() {
  const { toasts, hideToast } = useToastContext();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + 16 }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <StockyToast
          key={toast.id}
          visible={toast.visible}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          ctaText={toast.ctaText}
          durationMs={toast.durationMs}
          sound={toast.sound}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
    gap: 8,
  },
});
