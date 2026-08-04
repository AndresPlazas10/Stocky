type ObserverCallback = (entry: IntersectionObserverEntry) => void;

const elementMap = new WeakMap<Element, ObserverCallback>();

let observer: IntersectionObserver | null = null;

function getSharedObserver(options: IntersectionObserverInit): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = elementMap.get(entry.target);
          if (cb) cb(entry);
        }
      },
      options
    );
  }
  return observer;
}

export function observeElement(
  element: Element,
  callback: ObserverCallback,
  options: IntersectionObserverInit = {}
): () => void {
  const obs = getSharedObserver(options);
  elementMap.set(element, callback);
  obs.observe(element);

  return () => {
    elementMap.delete(element);
    obs.unobserve(element);
  };
}
