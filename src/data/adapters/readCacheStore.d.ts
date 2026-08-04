export function readCacheGet(cacheKey: string): unknown;

export function readCacheSet(cacheKey: string, value: unknown, ttlMs: number): void;

export function readCacheInvalidatePrefixes(prefixes?: string[]): number;

export function readCacheInvalidateMatching(predicate: (key: string) => boolean): number;

export function readCacheClear(): number;
