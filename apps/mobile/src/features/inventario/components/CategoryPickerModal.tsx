import { Pressable, Text } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { INVENTORY_CATEGORY_OPTIONS } from '../inventoryUtils';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  selectedCategory: string;
  onSelect: (category: string) => void;
  onClose: () => void;
};

export function CategoryPickerModal({ visible, selectedCategory, onSelect, onClose }: Props) {
  return (
    <StockyModal
      visible={visible}
      title="Seleccionar categoría"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={26}
      modalAnimationType="fade"
      animationDurationMs={150}
      bodyFlex
      perfTag="inventario.picker_categoria"
      onClose={onClose}
    >
      {INVENTORY_CATEGORY_OPTIONS.map((category) => {
        const selected = selectedCategory === category;
        return (
          <Pressable
            key={category}
            style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
            onPress={() => onSelect(category)}
          >
            <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>{category}</Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
