export const ASYNC_STATES = Object.freeze({
  LOADING_INITIAL: 'LOADING_INITIAL',
  LOADING_BACKGROUND: 'LOADING_BACKGROUND',
  EMPTY_STATE: 'EMPTY_STATE',
  ERROR_STATE: 'ERROR_STATE',
  NO_RESULTS: 'NO_RESULTS',
  OFFLINE_MODE: 'OFFLINE_MODE',
  SYNCING_REALTIME: 'SYNCING_REALTIME',
  ACTION_PROCESSING: 'ACTION_PROCESSING',
  IDLE: 'IDLE'
});

export function resolveAsyncState({
  loading = false,
  error = null,
  offline = false,
  hasData = false,
  hasFilters = false,
  isBackgroundRefetch = false,
  syncingRealtime = false,
  actionProcessing = false
} = {}) {
  if (offline) return ASYNC_STATES.OFFLINE_MODE;
  if (error && !hasData) return ASYNC_STATES.ERROR_STATE;
  if (loading && !hasData) return ASYNC_STATES.LOADING_INITIAL;
  if (loading && hasData) return ASYNC_STATES.LOADING_BACKGROUND;
  if (isBackgroundRefetch && hasData) return ASYNC_STATES.LOADING_BACKGROUND;
  if (syncingRealtime && hasData) return ASYNC_STATES.SYNCING_REALTIME;
  if (actionProcessing && hasData) return ASYNC_STATES.ACTION_PROCESSING;
  if (!hasData && hasFilters) return ASYNC_STATES.NO_RESULTS;
  if (!hasData) return ASYNC_STATES.EMPTY_STATE;
  return ASYNC_STATES.IDLE;
}
