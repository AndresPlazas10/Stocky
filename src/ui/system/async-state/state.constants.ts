export const ASYNC_STATES = Object.freeze({
  LOADING_INITIAL: "LOADING_INITIAL" as const,
  LOADING_BACKGROUND: "LOADING_BACKGROUND" as const,
  EMPTY_STATE: "EMPTY_STATE" as const,
  ERROR_STATE: "ERROR_STATE" as const,
  NO_RESULTS: "NO_RESULTS" as const,
  OFFLINE_MODE: "OFFLINE_MODE" as const,
  SYNCING_REALTIME: "SYNCING_REALTIME" as const,
  ACTION_PROCESSING: "ACTION_PROCESSING" as const,
  IDLE: "IDLE" as const,
});

type AsyncStateParams = {
  loading?: boolean;
  error?: unknown;
  offline?: boolean;
  hasData?: boolean;
  hasFilters?: boolean;
  isBackgroundRefetch?: boolean;
  syncingRealtime?: boolean;
  actionProcessing?: boolean;
};

export function resolveAsyncState({
  loading = false,
  error = null,
  offline = false,
  hasData = false,
  hasFilters = false,
  isBackgroundRefetch = false,
  syncingRealtime = false,
  actionProcessing = false,
}: AsyncStateParams = {}): string {
  if (offline && hasData) return ASYNC_STATES.OFFLINE_MODE;
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
