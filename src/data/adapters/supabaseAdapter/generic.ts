import { supabase } from '../../../supabase/Client';
import { logger } from '../../../utils/logger';
import { SLOW_QUERY_THRESHOLD_MS } from './shared.js';

export const genericAdapter = {
  async getPaginatedTableRows({
    tableName,
    selectSql = '*',
    filters = {},
    orderBy = { column: 'created_at', ascending: false },
    from = 0,
    to = 49,
    countMode = 'exact'
  }) {
    const startedAt = Date.now();
    const selectOptions = countMode ? { count: countMode } : undefined;
    let query = supabase
      .from(tableName)
      .select(selectSql, selectOptions)
      .order(orderBy?.column || 'created_at', {
        ascending: Boolean(orderBy?.ascending)
      })
      .range(from, to);

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });

    const result = await query;
    const durationMs = Date.now() - startedAt;
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn('[perf] slow paginated query', {
        tableName,
        durationMs,
        from,
        to,
        orderBy,
        filters
      });
    }

    return result;
  },
};
