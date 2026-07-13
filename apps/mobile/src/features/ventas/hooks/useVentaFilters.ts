import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startOfDay,
  startOfMonth,
  formatDayKey,
  parseDayKey,
  clampDate,
  capitalizeLabel,
  formatDayLabelFromKey,
  getRecordDayKey,
} from '../../../utils/dateHelpers';
import type { VentaRecord } from '../../../services/ventasService';

const PAGE_SIZE = 20;

export function useVentaFilters(ventas: VentaRecord[], firstVentaDayKey: string | null) {
  const { t } = useTranslation();
  const [dayFilter, setDayFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [rawPage, setRawPage] = useState(1);
  const [dayCalendarMonth, setDayCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showDayFilterModal, setShowDayFilterModal] = useState(false);
  const [showSellerFilterModal, setShowSellerFilterModal] = useState(false);

  const todayDayKey = formatDayKey(new Date());
  const fallbackFirstVentaDayKey = useMemo(() => {
    const unique = Array.from(
      new Set(
        ventas.map((venta) => getRecordDayKey(venta.created_at)).filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return unique[0] || null;
  }, [ventas]);

  const minSelectableDayKey = firstVentaDayKey || fallbackFirstVentaDayKey || todayDayKey;
  const maxSelectableDayKey = todayDayKey;
  const minSelectableDate = parseDayKey(minSelectableDayKey) || startOfDay(new Date());
  const maxSelectableDate = parseDayKey(maxSelectableDayKey) || startOfDay(new Date());

  const effectiveDayFilter = useMemo(() => {
    if (dayFilter === 'all') return 'all';
    const selected = parseDayKey(dayFilter);
    if (!selected) return 'all';
    const minTs = startOfDay(minSelectableDate).getTime();
    const maxTs = startOfDay(maxSelectableDate).getTime();
    const selectedTs = startOfDay(selected).getTime();
    if (selectedTs < minTs || selectedTs > maxTs) return 'all';
    return dayFilter;
  }, [dayFilter, maxSelectableDate, minSelectableDate]);

  const minSelectableMonth = startOfMonth(minSelectableDate);
  const maxSelectableMonth = startOfMonth(maxSelectableDate);
  const currentCalendarMonth = startOfMonth(dayCalendarMonth);
  const canGoPrevMonth = currentCalendarMonth.getTime() > minSelectableMonth.getTime();
  const canGoNextMonth = currentCalendarMonth.getTime() < maxSelectableMonth.getTime();
  const currentCalendarMonthLabel = useMemo(
    () =>
      capitalizeLabel(
        new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
          dayCalendarMonth,
        ),
      ),
    [dayCalendarMonth],
  );

  const calendarDayCells = useMemo(() => {
    const monthStart = startOfMonth(dayCalendarMonth);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdayOffset = (monthStart.getDay() + 6) % 7;
    const cells: ({
      key: string;
      day: number;
      disabled: boolean;
      selected: boolean;
      isToday: boolean;
    } | null)[] = [];

    for (let index = 0; index < weekdayOffset; index += 1) {
      cells.push(null);
    }

    const minTs = startOfDay(minSelectableDate).getTime();
    const maxTs = startOfDay(maxSelectableDate).getTime();
    const selectedKey = dayFilter === 'all' ? '' : dayFilter;
    const todayKey = formatDayKey(new Date());

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = formatDayKey(date);
      const ts = startOfDay(date).getTime();
      const disabled = ts < minTs || ts > maxTs;
      cells.push({
        key,
        day,
        disabled,
        selected: key === selectedKey,
        isToday: key === todayKey,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [dayCalendarMonth, dayFilter, maxSelectableDate, minSelectableDate]);

  const sellerOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        ventas
          .map((venta) => String(venta.seller_name || t('ventasSection.admin')).trim())
          .filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    return [
      { value: 'all', label: t('ventasSection.allSellers') },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [ventas]);

  const filteredVentas = useMemo(() => {
    return ventas.filter((venta) => {
      if (effectiveDayFilter !== 'all' && getRecordDayKey(venta.created_at) !== effectiveDayFilter)
        return false;
      if (
        sellerFilter !== 'all' &&
        String(venta.seller_name || t('ventasSection.admin')).trim() !== sellerFilter
      )
        return false;
      return true;
    });
  }, [effectiveDayFilter, sellerFilter, ventas]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredVentas.length / PAGE_SIZE)),
    [filteredVentas.length],
  );

  const currentPage = useMemo(
    () => Math.max(1, Math.min(rawPage, totalPages)),
    [rawPage, totalPages],
  );

  const paginatedVentas = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredVentas.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredVentas]);

  const pageRange = useMemo(() => {
    if (filteredVentas.length === 0) return { from: 0, to: 0 };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, filteredVentas.length);
    return { from, to };
  }, [currentPage, filteredVentas.length]);

  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  const selectedDayLabel = useMemo(() => formatDayLabelFromKey(dayFilter), [dayFilter]);
  const selectedSellerLabel = useMemo(
    () =>
      sellerOptions.find((option) => option.value === sellerFilter)?.label ||
      t('ventasSection.allSellers'),
    [sellerFilter, sellerOptions],
  );

  const openDayFilterCalendar = useCallback(() => {
    const selectedDate = dayFilter !== 'all' ? parseDayKey(dayFilter) : null;
    const baseDate = selectedDate || maxSelectableDate;
    const clamped = clampDate(baseDate, minSelectableDate, maxSelectableDate);
    setDayCalendarMonth(startOfMonth(clamped));
    setShowDayFilterModal(true);
  }, [dayFilter, maxSelectableDate, minSelectableDate]);

  const clearFilters = useCallback(() => {
    setDayFilter('all');
    setSellerFilter('all');
    setRawPage(1);
  }, []);

  return {
    dayFilter,
    setDayFilter,
    sellerFilter,
    setSellerFilter,
    currentPage,
    setCurrentPage: setRawPage,
    dayCalendarMonth,
    setDayCalendarMonth,
    showDayFilterModal,
    setShowDayFilterModal,
    showSellerFilterModal,
    setShowSellerFilterModal,
    minSelectableDayKey,
    maxSelectableDayKey,
    minSelectableDate,
    maxSelectableDate,
    canGoPrevMonth,
    canGoNextMonth,
    currentCalendarMonthLabel,
    calendarDayCells,
    sellerOptions,
    filteredVentas,
    totalPages,
    paginatedVentas,
    pageRange,
    canPrevPage,
    canNextPage,
    selectedDayLabel,
    selectedSellerLabel,
    openDayFilterCalendar,
    clearFilters,
  };
}
