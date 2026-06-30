import { RefreshCw } from "lucide-react";

type RetryActionProps = {
  onRetry?: () => void;
  label?: string;
  className?: string;
};

export function RetryAction({
  onRetry,
  label = "Reintentar",
  className = "",
}: RetryActionProps) {
  if (!onRetry) return null;

  return (
    <button
      type="button"
      onClick={onRetry}
      className={`inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 ${className}`}
    >
      <RefreshCw className="h-4 w-4" />
      {label}
    </button>
  );
}

export default RetryAction;
