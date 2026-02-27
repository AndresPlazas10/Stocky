import { CheckCircle2 } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert.jsx';

export function SaleSuccessAlert({
  isVisible,
  onClose,
  title = 'Operacion completada',
  message = '',
  details = []
}) {
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
