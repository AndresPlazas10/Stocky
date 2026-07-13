import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DASHBOARD_WARMUP_PHASE } from "../services/dashboardWarmupService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type WarmupStatusBadgeProps = {
  status?: {
    phase?: string;
    reason?: string;
  };
  compact?: boolean;
  className?: string;
};

function resolveBadgePresentation(
  status: WarmupStatusBadgeProps["status"],
  isOnline: boolean,
  t: (key: string) => string
) {
  const phase = status?.phase || DASHBOARD_WARMUP_PHASE.IDLE;
  const reason = String(status?.reason || "").trim().toLowerCase();

  if (phase === DASHBOARD_WARMUP_PHASE.RUNNING) {
    return {
      label: t('connectivity.preparing'),
      className: "bg-gray-100 text-gray-800 border-gray-200",
      Icon: Loader2,
      spinning: true,
    };
  }

  if (phase === DASHBOARD_WARMUP_PHASE.READY) {
    return {
      label: isOnline
        ? t('connectivity.online')
        : t('connectivity.offline'),
      className: isOnline
        ? "bg-green-100 text-green-800 border-green-200"
        : "bg-red-100 text-red-800 border-red-200",
      Icon: CheckCircle2,
      spinning: false,
    };
  }

  if (phase === DASHBOARD_WARMUP_PHASE.ERROR) {
    return {
      label: t('connectivity.partialOffline'),
      className: "bg-amber-100 text-amber-800 border-amber-200",
      Icon: AlertCircle,
      spinning: false,
    };
  }

  if (!isOnline || reason === "offline") {
    return {
      label: t('connectivity.offline'),
      className: "bg-red-100 text-red-800 border-red-200",
      Icon: AlertCircle,
      spinning: false,
    };
  }

  if (reason === "local_sync_disabled") {
    return {
      label: t('connectivity.online'),
      className: "bg-green-100 text-green-800 border-green-200",
      Icon: CheckCircle2,
      spinning: false,
    };
  }

  return {
    label: t('connectivity.online'),
    className: "bg-green-100 text-green-800 border-green-200",
    Icon: CheckCircle2,
    spinning: false,
  };
}

export function WarmupStatusBadge({
  status,
  compact = false,
  className = "",
}: WarmupStatusBadgeProps) {
  const { t } = useTranslation('common');
  const isOnline = useOnlineStatus();
  const presentation = resolveBadgePresentation(status, isOnline, t);
  const Icon = presentation.Icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        presentation.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={presentation.label}
    >
      <Icon
        className={`h-3.5 w-3.5 ${presentation.spinning ? "animate-spin" : ""}`}
      />
      {!compact && <span>{presentation.label}</span>}
    </span>
  );
}

export default WarmupStatusBadge;
