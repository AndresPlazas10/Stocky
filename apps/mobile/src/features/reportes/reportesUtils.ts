import i18next from 'i18next';
import type { ReportesPeriod } from '../../domain/reportes/contracts';

export const PERIOD_OPTIONS: { value: ReportesPeriod; label: string }[] = [
  { value: 'today', label: i18next.t('reportesSection.today') },
  { value: '7d', label: i18next.t('reportesSection.days7') },
  { value: '30d', label: i18next.t('reportesSection.days30') },
  { value: 'all', label: i18next.t('reportesSection.all') },
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
  return (
    PERIOD_OPTIONS.find((item) => item.value === period)?.label || i18next.t('reportesSection.all')
  );
}
