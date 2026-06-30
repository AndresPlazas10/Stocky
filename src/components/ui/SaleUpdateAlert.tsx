import { AlertTriangle } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert';

interface SaleUpdateAlertProps {
  isVisible: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  details?: Array<{ label?: string; value?: string }>;
  duration?: number;
}

export function SaleUpdateAlert({
  isVisible,
  onClose,
  title = 'Actualización aplicada',
  message = '',
  details = []
}: SaleUpdateAlertProps) {
  return (
    <SyncStyleAlert
      isVisible={isVisible}
      onClose={onClose}
      type="warning"
      title={title}
      message={message}
      details={details}
      icon={AlertTriangle}
    />
  );
}
