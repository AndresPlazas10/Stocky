import { AlertCircle } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert.jsx';

export function SaleErrorAlert({
  isVisible,
  onClose,
  title = 'Error en la operacion',
  message = '',
  details = []
}) {
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
