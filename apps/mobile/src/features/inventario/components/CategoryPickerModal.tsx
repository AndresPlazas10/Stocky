import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StockyModal } from '../../../ui/StockyModal';
import { PRODUCT_CATEGORIES } from '../inventoryUtils';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  selectedCategory: string;
  onSelect: (category: string) => void;
  onClose: () => void;
};

export function CategoryPickerModal({ visible, selectedCategory, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      title={t('inventarioSection.selectCategory')}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={26}
      bodyFlex
      perfTag="inventario.picker_categoria"
      onClose={onClose}
    >
      {PRODUCT_CATEGORIES.map((category) => {
        const selected = selectedCategory === category.value;
        return (
          <Pressable
            key={category.value}
            style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
            onPress={() => onSelect(category.value)}
          >
            <Text
              style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}
            >
              {t(category.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
