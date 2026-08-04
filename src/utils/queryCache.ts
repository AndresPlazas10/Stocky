interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

interface PaginationParams {
  page?: number;
  limit?: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;

  constructor(ttl = 5 * 60 * 1000) {
    this.ttl = ttl;
  }

  private generateKey(tableName: string, filters: Record<string, unknown>, pagination?: PaginationParams): string {
    const filterStr = JSON.stringify(filters || {});
    const pageStr = `${pagination?.page || 1}_${pagination?.limit || 50}`;
    return `${tableName}:${filterStr}:${pageStr}`;
  }

  get<T = unknown>(tableName: string, filters: Record<string, unknown>, pagination?: PaginationParams): T | null {
    const key = this.generateKey(tableName, filters, pagination);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T = unknown>(tableName: string, filters: Record<string, unknown>, pagination: PaginationParams | undefined, data: T): void {
    const key = this.generateKey(tableName, filters, pagination);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidate(tableName: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tableName}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export const queryCache = new QueryCache();

class RequestDeduplicator {
  private pending: Map<string, Promise<unknown>> = new Map();

  async execute<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }

    const promise = queryFn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise as Promise<T>;
  }
}

export const requestDeduplicator = new RequestDeduplicator();

export default {
  queryCache,
  requestDeduplicator
};
