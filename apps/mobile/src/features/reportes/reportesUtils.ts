import type { ReportesPeriod } from '../../domain/reportes/contracts';

export const PERIOD_OPTIONS: Array<{ value: ReportesPeriod; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Todo' },
];

export function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function getPeriodLabel(period: ReportesPeriod) {
  return PERIOD_OPTIONS.find((item) => item.value === period)?.label || 'Todo';
}
