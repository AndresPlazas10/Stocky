import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatElapsedTime } from '@stocky/shared';

interface ElapsedTimerProps {
  startedAt: number;
  className?: string;
}

/**
 * Temporizador de la cocina: muestra cuánto tiempo lleva el pedido en cocina
 * desde su llegada (startedAt). Tic local de 1s: solo re-renderiza este chip.
 * Al cambiar startedAt (pedido nuevo o cambio) se reinicia desde 00:00.
 */
export function ElapsedTimer({ startedAt, className = '' }: ElapsedTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const elapsedMs = startedAt > 0 ? now - startedAt : 0;

  return (
    <span
      data-testid="kitchen-order-timer"
      className={`inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white tabular-nums ${className}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {formatElapsedTime(elapsedMs)}
    </span>
  );
}
