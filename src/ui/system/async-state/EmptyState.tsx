import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: _Icon = Inbox,
  action = null,
  className = "",
}: EmptyStateProps) {
  const { t } = useTranslation("common");
  const resolvedTitle = title ?? t("empty.noDataToShow");
  const resolvedDescription = description ?? t("empty.noDataAvailable");
  return (
    <section
      className={`rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <_Icon className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{resolvedTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {resolvedDescription}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export default EmptyState;
