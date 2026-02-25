import { Inbox } from 'lucide-react';

export function EmptyState({
  title = 'No hay datos para mostrar',
  description = 'Cuando haya información disponible, aparecerá aquí.',
  icon: _Icon = Inbox,
  action = null,
  className = ''
}) {
  return (
    <section className={`rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center ${className}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <_Icon className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export default EmptyState;
