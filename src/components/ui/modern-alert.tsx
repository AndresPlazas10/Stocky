import { SyncStyleAlert } from './SyncStyleAlert';

interface ModernAlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export function ModernAlert({
  type = 'info',
  title = '',
  message = '',
  onClose,
  className = ''
}: ModernAlertProps) {
  return (
    <SyncStyleAlert
      isVisible
      type={type}
      title={title}
      message={message}
      onClose={onClose}
      usePortal={false}
      autoClose={false}
      className={className}
    />
  );
}

interface ModernToastProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  title?: string;
}

export function ModernToast({ isOpen, type, message, onClose, title = '' }: ModernToastProps) {
  return (
    <SyncStyleAlert
      isVisible={isOpen}
      type={type}
      title={title}
      message={message}
      onClose={onClose}
      usePortal={false}
      autoClose
    />
  );
}
