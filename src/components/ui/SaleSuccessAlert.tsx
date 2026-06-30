import { CheckCircle2 } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert';

interface SaleSuccessAlertProps {
  isVisible: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  details?: Array<{ label?: string; value?: string }>;
  duration?: number;
}

export function SaleSuccessAlert({
  isVisible,
  onClose,
  title = 'Operacion completada',
  message = '',
  details = []
}: SaleSuccessAlertProps) {
  return (
    <SyncStyleAlert
      isVisible={isVisible}
      onClose={onClose}
      type="success"
      title={title}
      message={message}
      details={details}
      icon={CheckCircle2}
    />
  );
}
