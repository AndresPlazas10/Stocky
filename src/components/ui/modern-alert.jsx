import { SyncStyleAlert } from './SyncStyleAlert.jsx';

export function ModernAlert({
  type = 'info',
  title = '',
  message = '',
  onClose,
  className = ''
}) {
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

export function ModernToast({ isOpen, type, message, onClose, title = '' }) {
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
