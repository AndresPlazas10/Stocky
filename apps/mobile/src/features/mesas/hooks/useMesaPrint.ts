import { useCallback, useRef, useState } from 'react';

export type UseMesaPrintProps = {
  setOrderModalError: (msg: string | null) => void;
};

export type UseMesaPrintReturn = {
  isPrintInProgress: boolean;
  beginPrintFlow: () => boolean;
  endPrintFlow: () => void;
};

export function useMesaPrint(_props: UseMesaPrintProps): UseMesaPrintReturn {
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
