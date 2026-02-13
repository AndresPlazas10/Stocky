import { Wifi, RefreshCw, Loader2 } from 'lucide-react';

export function BackgroundRefetchIndicator({
  isVisible = false,
  syncingRealtime = false,
  actionProcessing = false,
  className = ''
}) {
  if (!isVisible && !syncingRealtime && !actionProcessing) return null;

  const Icon = syncingRealtime ? Wifi : actionProcessing ? Loader2 : RefreshCw;
  const label = syncingRealtime
    ? 'Sincronizando en tiempo real'
    : actionProcessing
      ? 'Procesando cambios'
      : 'Actualizando datos';

  return (
    <div className={`sticky top-0 z-30 mb-3 flex justify-end ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
        <Icon className="h-3.5 w-3.5 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export default BackgroundRefetchIndicator;
