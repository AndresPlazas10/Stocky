import { AlertCircle } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert';

interface SaleErrorAlertProps {
  isVisible: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  details?: Array<{ label?: string; value?: string }>;
  duration?: number;
}

export function SaleErrorAlert({
  isVisible,
  onClose,
  title = 'Error en la operacion',
  message = '',
  details = []
}: SaleErrorAlertProps) {
  return (
    <SyncStyleAlert
      isVisible={isVisible}
      onClose={onClose}
      type="error"
      title={title}
      message={message}
      details={details}
      icon={AlertCircle}
    />
  );
}
