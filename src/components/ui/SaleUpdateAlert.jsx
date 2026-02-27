import { AlertTriangle } from 'lucide-react';
import { SyncStyleAlert } from './SyncStyleAlert.jsx';

export function SaleUpdateAlert({
  isVisible,
  onClose,
  title = 'Actualizacion aplicada',
  message = '',
  details = []
}) {
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
