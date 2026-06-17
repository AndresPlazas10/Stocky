import { Pressable, Text } from 'react-native';
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
  return (
    <StockyModal
      visible={visible}
      title="Seleccionar unidad"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={26}
      modalAnimationType="fade"
      animationDurationMs={150}
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
              {unit.label}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
