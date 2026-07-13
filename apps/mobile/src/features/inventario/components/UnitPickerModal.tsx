import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StockyModal } from '../../../ui/StockyModal';
import { UNIT_OPTIONS } from '../inventoryUtils';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  selectedUnit: string;
  onSelect: (unitValue: string) => void;
  onClose: () => void;
};

export function UnitPickerModal({ visible, selectedUnit, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      title={t('inventarioSection.selectUnit')}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={26}
      bodyFlex
      perfTag="inventario.picker_unidad"
      onClose={onClose}
    >
      {UNIT_OPTIONS.map((unit) => {
        const selected = selectedUnit === unit.value;
        return (
          <Pressable
            key={unit.value}
            style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
            onPress={() => onSelect(unit.value)}
          >
            <Text
              style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}
            >
              {t(unit.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
