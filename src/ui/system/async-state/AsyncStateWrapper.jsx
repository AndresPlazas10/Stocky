import { WifiOff, Search, Database } from 'lucide-react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus.js';
import { ASYNC_STATES, resolveAsyncState } from './state.constants.js';
import { SkeletonFactory } from './SkeletonFactory.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { BackgroundRefetchIndicator } from './BackgroundRefetchIndicator.jsx';

export function AsyncStateWrapper({
  children,
  loading = false,
  error = null,
  dataCount = 0,
  hasFilters = false,
  isBackgroundRefetch = false,
  syncingRealtime = false,
  actionProcessing = false,
  offlineMode,
  onRetry,
  skeletonType = 'table',
  emptyTitle,
  emptyDescription,
  emptyAction = null,
  noResultsTitle = 'Sin resultados',
  noResultsDescription = 'Prueba ajustando filtros o términos de búsqueda.',
  noResultsAction = null,
  bypassStateRendering = false,
  className = ''
}) {
  const isOnline = useOnlineStatus();
  const hasData = dataCount > 0;
  const offline = offlineMode ?? !isOnline;

  const state = resolveAsyncState({
    loading,
    error,
    offline,
    hasData,
    hasFilters,
    isBackgroundRefetch,
    syncingRealtime,
    actionProcessing
  });

  if (bypassStateRendering) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  if (state === ASYNC_STATES.LOADING_INITIAL) {
    return (
      <div className={className}>
        <SkeletonFactory type={skeletonType} />
      </div>
    );
  }

  if (state === ASYNC_STATES.ERROR_STATE) {
    return (
      <div className={className}>
        <ErrorState message={typeof error === 'string' ? error : undefined} onRetry={onRetry} />
      </div>
    );
  }

  if (state === ASYNC_STATES.OFFLINE_MODE && !hasData) {
    return (
      <div className={className}>
        <EmptyState
          icon={WifiOff}
          title="Sin conexión"
          description="Mostraremos la información tan pronto vuelva la conexión a internet."
          action={onRetry ? <button type="button" onClick={onRetry} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Reintentar</button> : null}
        />
      </div>
    );
  }

  if (state === ASYNC_STATES.NO_RESULTS) {
    return (
      <div className={className}>
        <EmptyState
          icon={Search}
          title={noResultsTitle}
          description={noResultsDescription}
          action={noResultsAction}
        />
      </div>
    );
  }

  if (state === ASYNC_STATES.EMPTY_STATE) {
    return (
      <div className={className}>
        <EmptyState
          icon={Database}
          title={emptyTitle || 'Aun no hay informacion'}
          description={emptyDescription || 'Cuando registres datos, los veras en esta seccion.'}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <BackgroundRefetchIndicator
        isVisible={state === ASYNC_STATES.LOADING_BACKGROUND}
        syncingRealtime={state === ASYNC_STATES.SYNCING_REALTIME}
        actionProcessing={state === ASYNC_STATES.ACTION_PROCESSING}
      />
      {children}
    </div>
  );
}

export default AsyncStateWrapper;
