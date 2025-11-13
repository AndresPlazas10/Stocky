import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './button';

export const ErrorMessage = ({ 
  title = 'Error',
  message = 'Ha ocurrido un error',
  onRetry 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-destructive/10 border-2 border-destructive/20 rounded-xl p-4 flex items-start gap-3"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-destructive mb-1">{title}</p>
        <p className="text-sm text-primary-600">{message}</p>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="mt-3 border-destructive text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export const ErrorPage = ({ 
  code = '500',
  title = 'Error del Servidor',
  message = 'Ha ocurrido un error inesperado. Por favor, intenta nuevamente.',
  showHome = true,
  showBack = true
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-50 via-background-100 to-accent-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
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
          <h2 className="text-2xl font-semibold text-primary-800 mb-4">{title}</h2>
          <p className="text-primary-600 mb-8">{message}</p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBack && (
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          )}
          {showHome && (
            <Button
              onClick={() => navigate('/')}
              className="gradient-primary text-white hover:opacity-90"
            >
              <Home className="w-4 h-4 mr-2" />
              Ir al Inicio
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const NotFoundPage = () => {
  return (
    <ErrorPage
      code="404"
      title="Página No Encontrada"
      message="La página que buscas no existe o ha sido movida."
      showHome={true}
      showBack={true}
    />
  );
};

export default ErrorMessage;
