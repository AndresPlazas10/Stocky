import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SyncStyleAlert } from './SyncStyleAlert';

interface SaleErrorAlertProps {
  isVisible: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  details?: Array<{ label?: string; value?: string }>;
  duration?: number;
  usePortal?: boolean;
}

export function SaleErrorAlert({
  isVisible,
  onClose,
  title,
  message = '',
  details = [],
  duration = 5000,
  usePortal = true
}: SaleErrorAlertProps) {
  const { t } = useTranslation('common');
  return (
    <SyncStyleAlert
      isVisible={isVisible}
      onClose={onClose}
      type="error"
      title={title || t('errors.operationError')}
      message={message}
      details={details}
      icon={AlertCircle}
      usePortal={usePortal}
      duration={duration}
    />
  );
}
