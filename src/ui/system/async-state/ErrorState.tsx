import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RetryAction } from "./RetryAction";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title,
  message,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const { t } = useTranslation("common");
  const resolvedTitle = title ?? t("errors.loadFailed");
  const resolvedMessage = message ?? t("errors.retryLoad");
  return (
    <section
      className={`rounded-2xl border border-red-200 bg-red-50 p-8 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-red-100 p-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-red-800">{resolvedTitle}</h3>
          <p className="mt-1 text-sm text-red-700">{resolvedMessage}</p>
          <RetryAction
            onRetry={onRetry}
            className="mt-4 bg-red-700 hover:bg-red-600"
          />
        </div>
      </div>
    </section>
  );
}

export default ErrorState;
