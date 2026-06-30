import React, { type ReactNode, type ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('[ui] ErrorBoundary caught', { error, info });
    Sentry.captureException(error, {
      extra: { componentStack: info?.componentStack },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const showTechnicalDetails = import.meta.env.DEV as boolean;
      return (
        <div className="h-screen flex items-center justify-center p-6 bg-gray-50 overflow-hidden">
          <div className="max-w-xl text-center max-h-[calc(100vh-120px)] overflow-auto">
            <h1 className="text-2xl font-bold mb-2">Ha ocurrido un error inesperado</h1>
            <p className="text-sm text-gray-600 mb-4">Intenta recargar la página. Si el problema persiste, contacta soporte.</p>
            {showTechnicalDetails && (
              <pre className="text-xs text-left bg-white p-3 rounded border overflow-x-auto text-red-600">{String(this.state.error)}</pre>
            )}
            <div className="mt-4">
              <button onClick={() => location.reload()} className="px-4 py-2 bg-green-600 text-white rounded">Recargar</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
