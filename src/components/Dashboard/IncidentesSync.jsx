import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react';
import { clearConflictEvents, listConflictEvents } from '../../sync/syncBootstrap.js';
import { Button } from '../ui/button.jsx';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO');
}

function toCsvValue(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function inferSeverity(reason = '') {
  const normalized = String(reason || '').toLowerCase();
  if (normalized.includes('reject') || normalized.includes('error') || normalized.includes('conflict')) return 'high';
  if (normalized.includes('retry') || normalized.includes('timeout')) return 'medium';
  return 'low';
}

export default function IncidentesSync({ businessId }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mutationType, setMutationType] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listConflictEvents({ limit: 500 });
      setIncidents(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'No se pudieron cargar los incidentes de sincronización.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents().catch(() => {});
  }, [loadIncidents, businessId]);

  const mutationTypes = useMemo(() => {
    return Array.from(new Set(incidents.map((item) => item.mutation_type).filter(Boolean))).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;

    return incidents.filter((item) => {
      const itemType = item.mutation_type || '';
      const itemReason = item.reason || '';
      const itemMutationId = item.mutation_id || '';
      const itemSeverity = inferSeverity(itemReason);
      const ts = Date.parse(item.created_at || '');

      if (mutationType !== 'all' && itemType !== mutationType) return false;
      if (severity !== 'all' && itemSeverity !== severity) return false;
      if (fromTs && Number.isFinite(ts) && ts < fromTs) return false;
      if (toTs && Number.isFinite(ts) && ts > toTs) return false;

      if (!term) return true;
      return (
        itemType.toLowerCase().includes(term) ||
        itemReason.toLowerCase().includes(term) ||
        itemMutationId.toLowerCase().includes(term)
      );
    });
  }, [fromDate, incidents, mutationType, search, severity, toDate]);

  const handleExportCsv = useCallback(() => {
    const header = ['created_at', 'business_id', 'mutation_type', 'mutation_id', 'severity', 'reason', 'details'];
    const lines = filtered.map((item) => [
      item.created_at || '',
      item.business_id || '',
      item.mutation_type || '',
      item.mutation_id || '',
      inferSeverity(item.reason),
      item.reason || '',
      item.details ? JSON.stringify(item.details) : ''
    ]);
    const csv = [header, ...lines].map((line) => line.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `incidentes-sync-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClearIncidents = useCallback(async () => {
    setWorkingAction('clear');
    try {
      await clearConflictEvents();
      await loadIncidents();
      setError('');
    } catch (clearError) {
      setError(clearError?.message || 'No se pudieron limpiar los incidentes.');
    } finally {
      setWorkingAction(null);
    }
  }, [loadIncidents]);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Incidentes de Sincronizacion</h2>
          <p className="text-sm text-gray-600">Bitacora local de conflictos y rechazos (conflict_log).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadIncidents().catch(() => {})}
            disabled={loading || workingAction !== null}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearIncidents}
            disabled={workingAction !== null}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar incidentes
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por tipo, reason o mutation_id"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={mutationType}
          onChange={(event) => setMutationType(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Todos los tipos</option>
          {mutationTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Severidad: todas</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Severidad</th>
              <th className="px-3 py-2">Mutation ID</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                  No hay incidentes para los filtros actuales.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const itemSeverity = inferSeverity(item.reason);
                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDate(item.created_at)}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.mutation_type || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        itemSeverity === 'high' ? 'bg-red-100 text-red-700' : '',
                        itemSeverity === 'medium' ? 'bg-amber-100 text-amber-700' : '',
                        itemSeverity === 'low' ? 'bg-slate-100 text-slate-700' : ''
                      ].join(' ')}>
                        {itemSeverity === 'high' ? 'Alta' : itemSeverity === 'medium' ? 'Media' : 'Baja'}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-gray-700" title={item.mutation_id || ''}>
                      {item.mutation_id || '-'}
                    </td>
                    <td className="max-w-[500px] truncate px-3 py-2 text-gray-700" title={item.reason || ''}>
                      {item.reason || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
