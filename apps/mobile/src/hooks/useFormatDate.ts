import { useCallback } from 'react';
import { useBusinessConfig } from '../contexts/BusinessConfigContext';
import {
  formatDate as sharedFormatDate,
  formatDateOnly as sharedFormatDateOnly,
  formatTimeOnly as sharedFormatTimeOnly,
  formatDateLong as sharedFormatDateLong,
  formatDateTimeTicket as sharedFormatDateTimeTicket,
  formatTimeCompact as sharedFormatTimeCompact,
  formatDateTimeReport as sharedFormatDateTimeReport,
} from '@stocky/shared/dates';

export function useFormatDate() {
  const { locale, timezone } = useBusinessConfig();
  const config = { locale, timezone };

  const formatDate = useCallback(
    (timestamp: string | Date | number | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      sharedFormatDate(timestamp, options, config),
    [locale, timezone],
  );

  const formatDateOnly = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatDateOnly(timestamp, config),
    [locale, timezone],
  );

  const formatTimeOnly = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatTimeOnly(timestamp, config),
    [locale, timezone],
  );

  const formatDateLong = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatDateLong(timestamp, config),
    [locale, timezone],
  );

  const formatDateTimeTicket = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatDateTimeTicket(timestamp, config),
    [locale, timezone],
  );

  const formatTimeCompact = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatTimeCompact(timestamp, config),
    [locale, timezone],
  );

  const formatDateTimeReport = useCallback(
    (timestamp: string | Date | number | null | undefined) =>
      sharedFormatDateTimeReport(timestamp, config),
    [locale, timezone],
  );

  return {
    formatDate,
    formatDateOnly,
    formatTimeOnly,
    formatDateLong,
    formatDateTimeTicket,
    formatTimeCompact,
    formatDateTimeReport,
  };
}
