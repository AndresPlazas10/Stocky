import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startOfDay,
  startOfMonth,
  formatDayKey,
  parseDayKey,
  clampDate,
  formatDayLabelFromKey,
  getRecordDayKey,
} from '../../../utils/dateHelpers';
import type { CompraRecord } from '../../../services/comprasService';

const PAGE_SIZE = 20;

export function useCompraFilters(purchases: CompraRecord[], supplierNameById: Map<string, string>) {
  const { t } = useTranslation();
  const [dayFilter, setDayFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [rawPage, setRawPage] = useState(1);
  const [dayCalendarMonth, setDayCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showDayFilterModal, setShowDayFilterModal] = useState(false);
  const [showSupplierFilterModal, setShowSupplierFilterModal] = useState(false);

  const todayDayKey = formatDayKey(new Date());
  const fallbackFirstCompraDayKey = useMemo(() => {
    const unique = Array.from(
      new Set(
        purchases
          .map((purchase) => getRecordDayKey(purchase.created_at))
          .filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return unique[0] || null;
  }, [purchases]);

  const minSelectableDayKey = fallbackFirstCompraDayKey || todayDayKey;
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

  const supplierOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        purchases
          .map((purchase) => purchase.supplier_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    return [
      { value: 'all', label: t('comprasSection.allSuppliers') },
      ...unique.map((value) => ({
        value,
        label: supplierNameById.get(value) || t('comprasSection.noSupplier'),
      })),
    ];
  }, [purchases, supplierNameById]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      if (
        effectiveDayFilter !== 'all' &&
        getRecordDayKey(purchase.created_at) !== effectiveDayFilter
      )
        return false;
      if (supplierFilter !== 'all' && purchase.supplier_id !== supplierFilter) return false;
      return true;
    });
  }, [effectiveDayFilter, purchases, supplierFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE)),
    [filteredPurchases.length],
  );

  const currentPage = useMemo(
    () => Math.max(1, Math.min(rawPage, totalPages)),
    [rawPage, totalPages],
  );

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPurchases.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPurchases]);

  const pageRange = useMemo(() => {
    if (filteredPurchases.length === 0) return { from: 0, to: 0 };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, filteredPurchases.length);
    return { from, to };
  }, [currentPage, filteredPurchases.length]);

  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  const selectedDayLabel = useMemo(() => formatDayLabelFromKey(dayFilter), [dayFilter]);
  const selectedSupplierLabel = useMemo(
    () =>
      supplierOptions.find((option) => option.value === supplierFilter)?.label ||
      t('comprasSection.allSuppliers'),
    [supplierFilter, supplierOptions],
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
    setSupplierFilter('all');
    setRawPage(1);
  }, []);

  return {
    dayFilter,
    setDayFilter,
    supplierFilter,
    setSupplierFilter,
    currentPage,
    setCurrentPage: setRawPage,
    dayCalendarMonth,
    setDayCalendarMonth,
    showDayFilterModal,
    setShowDayFilterModal,
    showSupplierFilterModal,
    setShowSupplierFilterModal,
    minSelectableDayKey,
    maxSelectableDayKey,
    minSelectableDate,
    maxSelectableDate,
    supplierOptions,
    filteredPurchases,
    totalPages,
    paginatedPurchases,
    pageRange,
    canPrevPage,
    canNextPage,
    selectedDayLabel,
    selectedSupplierLabel,
    openDayFilterCalendar,
    clearFilters,
  };
}
