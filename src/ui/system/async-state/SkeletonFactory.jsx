import { ShimmerAnimation } from './ShimmerAnimation.jsx';

function GenericHeader() {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <ShimmerAnimation className="mb-3 h-7 w-56" />
      <ShimmerAnimation className="h-4 w-72 max-w-full" />
    </div>
  );
}

function MesasSkeleton() {
  return (
    <div className="space-y-4">
      <GenericHeader />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`mesa-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <ShimmerAnimation className="mb-4 h-6 w-28" />
            <ShimmerAnimation className="mb-2 h-4 w-full" />
            <ShimmerAnimation className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardListSkeleton({ cards = 6 }) {
  return (
    <div className="space-y-4">
      <GenericHeader />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={`card-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <ShimmerAnimation className="mb-3 h-5 w-2/3" />
            <ShimmerAnimation className="mb-2 h-4 w-full" />
            <ShimmerAnimation className="mb-2 h-4 w-5/6" />
            <ShimmerAnimation className="h-9 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 8 }) {
  return (
    <div className="space-y-4">
      <GenericHeader />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <ShimmerAnimation className="h-5 w-72 max-w-full" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={`row-${i}`} className="grid grid-cols-12 gap-3">
              <ShimmerAnimation className="col-span-4 h-4" />
              <ShimmerAnimation className="col-span-2 h-4" />
              <ShimmerAnimation className="col-span-2 h-4" />
              <ShimmerAnimation className="col-span-2 h-4" />
              <ShimmerAnimation className="col-span-2 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`metric-${i}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <ShimmerAnimation className="mb-2 h-4 w-24" />
            <ShimmerAnimation className="h-8 w-32" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}

export function SkeletonFactory({ type = 'table' }) {
  if (type === 'dashboard') return <DashboardSkeleton />;
  if (type === 'mesas') return <MesasSkeleton />;
  if (type === 'ventas') return <TableSkeleton rows={10} />;
  if (type === 'compras') return <CardListSkeleton cards={6} />;
  if (type === 'inventario') return <TableSkeleton rows={8} />;
  if (type === 'clientes') return <TableSkeleton rows={6} />;
  if (type === 'empleados') return <CardListSkeleton cards={4} />;
  if (type === 'reportes') return <DashboardSkeleton />;
  if (type === 'facturas') return <TableSkeleton rows={7} />;
  return <TableSkeleton rows={8} />;
}

export default SkeletonFactory;
