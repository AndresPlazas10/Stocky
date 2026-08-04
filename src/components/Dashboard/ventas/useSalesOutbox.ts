import { useState, useEffect } from 'react';
import { getSalesOutboxSnapshot, subscribeSalesOutboxUpdates } from '@/data/commands/salesCommands';

export function useSalesOutbox() {
  const [salesOutboxState, setSalesOutboxState] = useState(() => getSalesOutboxSnapshot());

  useEffect(() => {
    const syncState = () => setSalesOutboxState(getSalesOutboxSnapshot());
    syncState();

    const unsubscribe = subscribeSalesOutboxUpdates((snapshot) => {
      setSalesOutboxState(snapshot);
    });

    const timer = setInterval(() => {
      const snapshot = getSalesOutboxSnapshot();
      setSalesOutboxState((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(snapshot)) return prev;
        return snapshot;
      });
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return salesOutboxState;
}
