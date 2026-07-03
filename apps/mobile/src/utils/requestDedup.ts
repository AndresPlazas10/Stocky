const pendingRequests = new Map<string, Promise<unknown>>();

export async function dedupedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
}
