import { useToastContext } from '../hooks/useToastContext';
import { StockyToast } from './StockyToast';

export function ToastHost() {
  const { toast, hideToast } = useToastContext();

  return (
    <StockyToast
      visible={toast.visible}
      type={toast.type}
      title={toast.title}
      message={toast.message}
      ctaText={toast.ctaText}
      durationMs={toast.durationMs}
      sound={toast.sound}
      onClose={hideToast}
    />
  );
}
