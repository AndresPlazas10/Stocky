import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyModal } from './StockyModal';
import {
  startOfDay,
  startOfMonth,
  addMonths,
  formatDayKey,
  capitalizeLabel,
  formatDayLabelFromKey,
} from '../utils/dateHelpers';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export type CalendarCell = {
  key: string;
  day: number;
  disabled: boolean;
  selected: boolean;
  isToday: boolean;
};

type Props = {
  visible: boolean;
  dayFilter: string;
  dayCalendarMonth: Date;
  minSelectableDate: Date;
  maxSelectableDate: Date;
  minSelectableDayKey: string;
  maxSelectableDayKey: string;
  onSelectDay: (dayKey: string) => void;
  onClose: () => void;
  onMonthChange: (newMonth: Date) => void;
};

export function DayFilterCalendarModal({
  visible,
  dayFilter,
  dayCalendarMonth,
  minSelectableDate,
  maxSelectableDate,
  minSelectableDayKey,
  maxSelectableDayKey,
  onSelectDay,
  onClose,
  onMonthChange,
}: Props) {
  const currentCalendarMonthLabel = useMemo(
    () =>
      capitalizeLabel(
        new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
          dayCalendarMonth,
        ),
      ),
    [dayCalendarMonth],
  );

  const canGoPrevMonth =
    startOfMonth(addMonths(dayCalendarMonth, -1)) >= startOfMonth(minSelectableDate);
  const canGoNextMonth =
    startOfMonth(addMonths(dayCalendarMonth, 1)) <= startOfMonth(maxSelectableDate);

  const calendarDayCells = useMemo(() => {
    const monthStart = startOfMonth(dayCalendarMonth);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdayOffset = (monthStart.getDay() + 6) % 7;
    const cells: (CalendarCell | null)[] = [];

    for (let i = 0; i < weekdayOffset; i++) cells.push(null);

    const minTs = startOfDay(minSelectableDate).getTime();
    const maxTs = startOfDay(maxSelectableDate).getTime();
    const selectedKey = dayFilter === 'all' ? '' : dayFilter;
    const todayKey = formatDayKey(new Date());

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = formatDayKey(date);
      const ts = startOfDay(date).getTime();
      const disabled = ts < minTs || ts > maxTs;
      cells.push({ key, day, disabled, selected: key === selectedKey, isToday: key === todayKey });
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [dayCalendarMonth, dayFilter, maxSelectableDate, minSelectableDate]);

  return (
    <StockyModal
      visible={visible}
      title="Seleccionar día"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={30}
      onClose={onClose}
    >
      <View style={styles.calendarRangeHint}>
        <Text style={styles.calendarRangeHintText}>
          Desde {formatDayLabelFromKey(minSelectableDayKey)} hasta{' '}
          {formatDayLabelFromKey(maxSelectableDayKey)}
        </Text>
      </View>

      <View style={styles.calendarHeaderRow}>
        <Pressable
          style={[styles.calendarNavButton, !canGoPrevMonth && styles.buttonDisabled]}
          onPress={() => onMonthChange(startOfMonth(addMonths(dayCalendarMonth, -1)))}
          disabled={!canGoPrevMonth}
        >
          <Ionicons name="chevron-back" size={18} color="#475569" />
        </Pressable>

        <Text style={styles.calendarMonthLabel}>{currentCalendarMonthLabel}</Text>

        <Pressable
          style={[styles.calendarNavButton, !canGoNextMonth && styles.buttonDisabled]}
          onPress={() => onMonthChange(startOfMonth(addMonths(dayCalendarMonth, 1)))}
          disabled={!canGoNextMonth}
        >
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </Pressable>
      </View>

      <View style={styles.calendarWeekRow}>
        {WEEKDAY_LABELS.map((dayLabel) => (
          <View key={dayLabel} style={styles.calendarWeekDayCell}>
            <Text style={styles.calendarWeekDayText}>{dayLabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendarDayCells.map((cell, index) => {
          if (!cell) {
            return <View key={`empty-${index}`} style={styles.calendarDayCellEmpty} />;
          }
          return (
            <Pressable
              key={cell.key}
              style={[
                styles.calendarDayCell,
                cell.disabled && styles.calendarDayCellDisabled,
                cell.selected && styles.calendarDayCellSelected,
              ]}
              onPress={() => {
                if (cell.disabled) return;
                onSelectDay(cell.key);
              }}
              disabled={cell.disabled}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  cell.disabled && styles.calendarDayTextDisabled,
                  cell.selected && styles.calendarDayTextSelected,
                  cell.isToday && !cell.selected && styles.calendarDayTextToday,
                ]}
              >
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </StockyModal>
  );
}

const styles = StyleSheet.create({
  calendarRangeHint: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  calendarRangeHintText: { color: '#475569', fontSize: 12, fontWeight: '500' },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calendarWeekDayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  calendarWeekDayText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 },
  calendarDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCellEmpty: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  calendarDayCellDisabled: { opacity: 0.3 },
  calendarDayCellSelected: { borderRadius: 10, backgroundColor: '#4F46E5' },
  calendarDayText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  calendarDayTextDisabled: { color: '#94A3B8' },
  calendarDayTextSelected: { color: '#EDE9FE', fontWeight: '700' },
  calendarDayTextToday: { color: '#2563EB', fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
});
