import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Home, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorMessage = ({
  title,
  message,
  onRetry
}: ErrorMessageProps) => {
  const { t } = useTranslation('common');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-destructive/10 border-2 border-destructive/20 rounded-xl p-4 flex items-start gap-3"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-destructive mb-1">{title || t('status.error')}</p>
        <p className="text-sm text-primary-600">{message || t('errors.unknown')}</p>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="mt-3 border-destructive text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('buttons.retry')}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

interface ErrorPageProps {
  code?: string;
  title?: string;
  message?: string;
  showHome?: boolean;
  showBack?: boolean;
}

export const ErrorPage = ({
  code = '500',
  title,
  message,
  showHome = true,
  showBack = true
}: ErrorPageProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background-50 via-background-100 to-accent-100 p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center max-h-[calc(100vh-120px)] overflow-auto"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="text-6xl font-bold text-primary-900 mb-2">{code}</h1>
          <h2 className="text-2xl font-semibold text-primary-800 mb-4">
            {title || (code === '500' ? t('errors.serverError') : t('status.error'))}
          </h2>
          <p className="text-primary-600 mb-8">
            {message || t('errors.serverErrorDescription')}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBack && (
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('buttons.back')}
            </Button>
          )}
          {showHome && (
            <Button
              onClick={() => navigate('/')}
              className="gradient-primary text-white hover:opacity-90"
            >
              <Home className="w-4 h-4 mr-2" />
              {t('navigation.home')}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const NotFoundPage = () => {
  const { t } = useTranslation('common');

  return (
    <ErrorPage
      code="404"
      title={t('errors.pageNotFound')}
      message={t('errors.pageNotFoundDescription')}
      showHome={true}
      showBack={true}
    />
  );
};

export default ErrorMessage;
