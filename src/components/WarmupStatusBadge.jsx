import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { DASHBOARD_WARMUP_PHASE } from '../services/dashboardWarmupService.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

function resolveBadgePresentation(status, isOnline) {
  const phase = status?.phase || DASHBOARD_WARMUP_PHASE.IDLE;
  const reason = String(status?.reason || '').trim().toLowerCase();

  if (phase === DASHBOARD_WARMUP_PHASE.RUNNING) {
    return {
      label: 'Preparando offline',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      Icon: Loader2,
      spinning: true
    };
  }

  if (phase === DASHBOARD_WARMUP_PHASE.READY) {
    return {
      label: isOnline ? 'Con internet' : 'Sin internet (Modo offline)',
      className: isOnline
        ? 'bg-green-100 text-green-800 border-green-200'
        : 'bg-red-100 text-red-800 border-red-200',
      Icon: CheckCircle2,
      spinning: false
    };
  }

  if (phase === DASHBOARD_WARMUP_PHASE.ERROR) {
    return {
      label: 'Offline parcial',
      className: 'bg-amber-100 text-amber-800 border-amber-200',
      Icon: AlertCircle,
      spinning: false
    };
  }

  if (!isOnline || reason === 'offline') {
    return {
      label: 'Sin internet (Modo offline)',
      className: 'bg-red-100 text-red-800 border-red-200',
      Icon: AlertCircle,
      spinning: false
    };
  }

  if (reason === 'local_sync_disabled') {
    return {
      label: 'Con internet',
      className: 'bg-green-100 text-green-800 border-green-200',
      Icon: CheckCircle2,
      spinning: false
    };
  }

  return {
    label: 'Con internet',
    className: 'bg-green-100 text-green-800 border-green-200',
    Icon: CheckCircle2,
    spinning: false
  };
}

export function WarmupStatusBadge({ status, compact = false, className = '' }) {
  const isOnline = useOnlineStatus();
  const presentation = resolveBadgePresentation(status, isOnline);
  const Icon = presentation.Icon;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        presentation.className,
        className
      ].filter(Boolean).join(' ')}
      title={presentation.label}
    >
      <Icon className={`h-3.5 w-3.5 ${presentation.spinning ? 'animate-spin' : ''}`} />
      {!compact && <span>{presentation.label}</span>}
    </span>
  );
}

export default WarmupStatusBadge;
