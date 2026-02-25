import { useEffect, useState } from 'react';
import { getWarmupStatus, subscribeWarmupStatus } from '../services/dashboardWarmupService.js';

export function useWarmupStatus(businessId) {
  const [status, setStatus] = useState(() => getWarmupStatus(businessId));

  useEffect(() => {
    if (!businessId) {
      setStatus(getWarmupStatus(null));
      return undefined;
    }

    const unsubscribe = subscribeWarmupStatus(businessId, (nextStatus) => {
      setStatus(nextStatus);
    });

    return unsubscribe;
  }, [businessId]);

  return status;
}

export default useWarmupStatus;
