import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectionId } from '../../../navigation/sections';
import { useSectionMeta } from '../../../navigation/sections';
import { StockyButton } from '../../../ui/StockyButton';
import { StockyCard } from '../../../ui/StockyCard';
import { STOCKY_COLORS } from '../../../theme/tokens';

type Props = {
  sectionId: SectionId;
  disabledByFlag: boolean;
  onGoHome: () => void;
};

export function SectionComingSoon({ sectionId, disabledByFlag, onGoHome }: Props) {
  const { t } = useTranslation();
  const sectionMeta = useSectionMeta();
  const section = useMemo(
    () => sectionMeta.find((s) => s.id === sectionId),
    [sectionMeta, sectionId],
  );

  return (
    <StockyCard
      title={section?.label || sectionId}
      subtitle={disabledByFlag ? t('errors.moduleDisabled') : t('errors.moduleComingSoon')}
    >
      <View style={styles.checklist}>
        <Text style={styles.title}>Checklist de paridad</Text>
        <Text style={styles.item}>- Jerarquía visual y estructura 1:1 con web móvil</Text>
        <Text style={styles.item}>- Estados loading/empty/error/success</Text>
        <Text style={styles.item}>- Flujos CRUD y modales principales</Text>
        <Text style={styles.item}>- Validación cruzada web vs RN con mismo negocio</Text>
      </View>

      <StockyButton variant="secondary" onPress={onGoHome}>
        {t('buttons.backToHome')}
      </StockyButton>
    </StockyCard>
  );
}

const styles = StyleSheet.create({
  checklist: {
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.65)',
    padding: 12,
  },
  title: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  item: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
