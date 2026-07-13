import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../../../theme/tokens';

type Props = {
  isCreatingMesa: boolean;
  onOpenAddMesa: () => void;
};

export const MesasPanelHeader = React.memo(function MesasPanelHeader({
  isCreatingMesa,
  onOpenAddMesa,
}: Props) {
  const { t } = useTranslation('mesas');

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.icon}
        >
          <Ionicons name="layers-outline" size={30} color={STOCKY_COLORS.white} />
        </LinearGradient>
        <Text style={styles.title} numberOfLines={2}>
          {t('title')}
        </Text>
      </View>

      <Pressable style={styles.addButtonWrap} onPress={onOpenAddMesa} disabled={isCreatingMesa}>
        <LinearGradient
          colors={isCreatingMesa ? ['#7D8AA7', '#9CA3AF'] : ['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={16} color={STOCKY_COLORS.white} />
          <Text style={styles.addButtonText}>{t('buttons.addTable')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
