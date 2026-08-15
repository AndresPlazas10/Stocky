import { useCallback, useRef, useState } from 'react';

export type UseMesaPrintReturn = {
  isPrintInProgress: boolean;
  beginPrintFlow: () => boolean;
  endPrintFlow: () => void;
};

export function useMesaPrint(): UseMesaPrintReturn {
  const [isPrintInProgress, setIsPrintInProgress] = useState(false);
  const printInFlightRef = useRef(false);

  const beginPrintFlow = useCallback(() => {
    if (printInFlightRef.current) return false;
    printInFlightRef.current = true;
    setIsPrintInProgress(true);
    return true;
  }, []);

  const endPrintFlow = useCallback(() => {
    printInFlightRef.current = false;
    setIsPrintInProgress(false);
  }, []);

  return {
    isPrintInProgress,
    beginPrintFlow,
    endPrintFlow,
  };
}
