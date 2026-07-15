import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

type FilterFieldState = {
  icon: string;
  label: string;
  selectedLabel: string;
  isActive: boolean;
  onOpen: () => void;
};

type Props = {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  dayField: FilterFieldState;
  secondField?: FilterFieldState;
  onClearFilters: () => void;
};

export function RecordFilterCard({
  title,
  subtitle,
  expanded,
  onToggle,
  dayField,
  secondField,
  onClearFilters,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.filtersCard}>
      <Pressable style={styles.filtersHeaderRow} onPress={onToggle}>
        <View style={styles.filtersTitleRow}>
          <Ionicons name="funnel-outline" size={16} color={STOCKY_COLORS.primary700} />
          <Text style={styles.filtersTitle}>{title}</Text>
        </View>
        <Pressable style={styles.filtersToggleButton} onPress={onToggle}>
          <Text style={styles.filtersToggleText}>{expanded ? t('buttons.close') : t('buttons.open')}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={STOCKY_COLORS.textSecondary}
          />
        </Pressable>
      </Pressable>

      {expanded ? (
        <>
          <Text style={styles.filtersSubTitle}>{subtitle}</Text>

          <FilterFieldCard
            icon="calendar-clear-outline"
            label={dayField.label}
            selectedLabel={dayField.selectedLabel}
            isActive={dayField.isActive}
            onPress={dayField.onOpen}
          />

          {secondField ? (
            <FilterFieldCard
              icon={secondField.icon}
              label={secondField.label}
              selectedLabel={secondField.selectedLabel}
              isActive={secondField.isActive}
              onPress={secondField.onOpen}
            />
          ) : null}

          <Pressable style={styles.clearFilterButton} onPress={onClearFilters}>
            <Ionicons name="close" size={16} color={STOCKY_COLORS.textMuted} />
            <Text style={styles.clearFilterButtonText}>{t('buttons.clear')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function FilterFieldCard({
  icon,
  label,
  selectedLabel,
  isActive,
  onPress,
}: {
  icon: string;
  label: string;
  selectedLabel: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.filterFieldCard}>
      <View style={styles.filterFieldHeader}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={STOCKY_COLORS.textMuted}
        />
        <Text style={styles.filterFieldLabel}>{label}</Text>
      </View>
      <Pressable style={styles.filterSelectBox} onPress={onPress}>
        <Text style={[styles.filterSelectText, isActive && styles.filterSelectTextActive]}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={STOCKY_COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersCard: {
    backgroundColor: STOCKY_COLORS.surface,
    borderRadius: STOCKY_RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    gap: 12,
  },
  filtersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filtersTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filtersTitle: { fontSize: 15, fontWeight: '600', color: STOCKY_COLORS.textPrimary },
  filtersToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
  },
  filtersToggleText: { fontSize: 12, fontWeight: '600', color: STOCKY_COLORS.textSecondary },
  filtersSubTitle: { fontSize: 12, color: STOCKY_COLORS.textMuted },
  filterFieldCard: {
    backgroundColor: STOCKY_COLORS.backgroundSoft,
    borderRadius: STOCKY_RADIUS.md,
    padding: 12,
    gap: 8,
  },
  filterFieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: STOCKY_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: STOCKY_COLORS.surface,
    borderRadius: STOCKY_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
  },
  filterSelectText: { fontSize: 14, fontWeight: '600', color: STOCKY_COLORS.textSecondary },
  filterSelectTextActive: { color: STOCKY_COLORS.primary700 },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
  },
  clearFilterButtonText: { fontSize: 12, fontWeight: '600', color: STOCKY_COLORS.textMuted },
});
