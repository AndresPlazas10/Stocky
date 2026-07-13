import { motion } from 'framer-motion';
import type { ElementType } from 'react';
import { Package, FileText, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon?: ElementType;
  title?: string;
  message?: string;
  action?: () => void;
  actionLabel?: string;
}

export const EmptyState = ({
  icon: _Icon = Inbox,
  title,
  message,
  action,
  actionLabel
}: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mb-4">
        <_Icon className="w-10 h-10 text-accent-600" />
      </div>
      <h3 className="text-xl font-semibold text-primary-900 mb-2">{title || t('emptyState.noData')}</h3>
      <p className="text-primary-600 mb-6 max-w-sm">{message || t('emptyState.noItemsToShow')}</p>
      {action && (
        <button
          onClick={action}
          className="btn-primary"
        >
          {actionLabel || t('emptyState.createNew')}
        </button>
      )}
    </motion.div>
  );
};

interface EmptyProductsProps {
  onAdd?: () => void;
}

export const EmptyProducts = ({ onAdd }: EmptyProductsProps) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Package}
      title={t('emptyState.noProducts')}
      message={t('emptyState.noProductsYet')}
      action={onAdd}
      actionLabel={t('emptyState.addProduct')}
    />
  );
};

export const EmptyOrders = () => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={FileText}
      title={t('emptyState.noOrders')}
      message={t('emptyState.noOrdersFound')}
    />
  );
};

export default EmptyState;
