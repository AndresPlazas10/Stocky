import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import type { ComboRecord } from '../../../services/combosService';
import { buildComboCompositionText, formatComboStatusLabel, normalizeStatus } from '../comboUtils';
import { combosStyles as styles } from '../combosStyles';

type Props = {
  combo: ComboRecord;
  canManageCombos: boolean;
  onEdit: (combo: ComboRecord) => void;
  onDelete: (combo: ComboRecord) => void;
};

export const ComboCard = memo(function ComboCard({
  combo,
  canManageCombos,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const status = normalizeStatus(combo.estado);
  const isActive = status === 'active';

  return (
    <View style={styles.comboCard}>
      <View style={styles.comboHeader}>
        <View style={styles.comboNameRow}>
          <Ionicons name="layers-outline" size={24} color="#111827" />
          <Text style={styles.comboTitle} numberOfLines={1}>
            {combo.nombre}
          </Text>
        </View>
      </View>

      <View style={styles.comboTagRow}>
        <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
          {isActive ? <Ionicons name="checkmark" size={14} color="#067647" /> : null}
          <Text
            style={[
              styles.statusBadgeText,
              isActive ? styles.statusActiveText : styles.statusInactiveText,
            ]}
          >
            {formatComboStatusLabel(status)}
          </Text>
        </View>

        <View style={styles.comboCountTag}>
          <Ionicons name="cube-outline" size={13} color="#1D4ED8" />
          <Text style={styles.comboCountTagText}>
            {combo.combo_items.length} {t('combos.card.products')}
          </Text>
        </View>
      </View>

      {combo.descripcion ? (
        <Text style={styles.comboDescription} numberOfLines={2}>
          {combo.descripcion}
        </Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.comboInfoGrid}>
        <View style={styles.comboInfoCell}>
          <View style={styles.comboMetaTitleRow}>
            <Ionicons name="cash-outline" size={16} color="#111827" />
            <Text style={styles.metaLabel}>{t('combos.card.price')}</Text>
          </View>
          <StockyMoneyText value={combo.precio_venta} style={styles.metaValue} />
        </View>

        <View style={styles.comboInfoCell}>
          <View style={styles.comboMetaTitleRow}>
            <Ionicons name="layers-outline" size={16} color="#111827" />
            <Text style={styles.metaLabel}>{t('combos.card.productsLabel')}</Text>
          </View>
          <Text style={styles.metaValue}>{combo.combo_items.length}</Text>
        </View>

        <View style={[styles.comboInfoCell, styles.comboInfoCellFull]}>
          <Text style={styles.compositionTitle}>{t('combos.card.composition')}</Text>
          <Text style={styles.compositionText}>{buildComboCompositionText(combo)}</Text>
        </View>
      </View>

      {canManageCombos ? (
        <>
          <View style={styles.divider} />
          <View style={styles.comboActionsRow}>
            <Pressable
              style={[styles.comboEditButton, styles.comboActionHalf]}
              onPress={() => onEdit(combo)}
            >
              <Ionicons name="create-outline" size={18} color="#DDE6FF" />
              <Text style={styles.comboEditButtonText}>{t('combos.card.edit')}</Text>
            </Pressable>

            <Pressable
              style={[styles.comboDeleteButton, styles.comboActionHalf]}
              onPress={() => onDelete(combo)}
            >
              <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
              <Text style={styles.comboDeleteButtonText}>{t('combos.card.delete')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
});
