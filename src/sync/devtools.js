import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { logger } from '../utils/logger.js';
import {
  clearConflictEvents,
  clearOutboxEvents,
  clearConvergenceMetrics,
  clearLocalReadCache,
  enqueueDebugMutation,
  getLocalSyncHealth,
  listConvergenceMetrics,
  listConflictEvents,
  listOutboxEvents,
  runOutboxTick
} from './syncBootstrap.js';

function buildDevtoolsApi() {
  return {
    config: LOCAL_SYNC_CONFIG,
    health: () => getLocalSyncHealth(),
    tick: () => runOutboxTick(),
    outbox: {
      pending: (limit = 50) => listOutboxEvents({ status: 'pending', limit }),
      syncing: (limit = 50) => listOutboxEvents({ status: 'syncing', limit }),
      acked: (limit = 50) => listOutboxEvents({ status: 'acked', limit }),
      rejected: (limit = 50) => listOutboxEvents({ status: 'rejected', limit }),
      clear: () => clearOutboxEvents(),
      enqueueDebug: (payload = {}) => enqueueDebugMutation({ payload })
    },
    cache: {
      clear: () => clearLocalReadCache()
    },
    convergence: {
      list: (limit = 100) => listConvergenceMetrics({ limit }),
      clear: () => clearConvergenceMetrics()
    },
    conflicts: {
      list: (limit = 50) => listConflictEvents({ limit }),
      clear: () => clearConflictEvents()
    }
  };
}

export function registerLocalSyncDevtools() {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV) return;
  if (!LOCAL_SYNC_CONFIG.devtoolsEnabled) return;

  window.stockyLocalSync = buildDevtoolsApi();
  logger.info('[stocky] Devtools local sync disponible: window.stockyLocalSync');
}

export default registerLocalSyncDevtools;
