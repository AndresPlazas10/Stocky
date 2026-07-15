type Listener = () => void;

const listeners = new Set<Listener>();

export function onCatalogInvalidated(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitCatalogInvalidated(): void {
  for (const fn of Array.from(listeners)) {
    try {
      fn();
    } catch {
      // no-op
    }
  }
}
