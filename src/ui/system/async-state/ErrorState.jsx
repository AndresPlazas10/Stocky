import { AlertTriangle } from 'lucide-react';
import { RetryAction } from './RetryAction.jsx';

export function ErrorState({
  title = 'No pudimos cargar la información',
  message = 'Verifica tu conexión e intenta nuevamente.',
  onRetry,
  className = ''
}) {
  return (
    <section className={`rounded-2xl border border-red-200 bg-red-50 p-8 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-red-100 p-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-red-800">{title}</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>
          <RetryAction onRetry={onRetry} className="mt-4 bg-red-700 hover:bg-red-600" />
        </div>
      </div>
    </section>
  );
}

export default ErrorState;
