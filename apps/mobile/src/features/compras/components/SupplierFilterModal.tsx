import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StockyModal } from '../../../ui/StockyModal';
import { comprasStyles as s } from '../comprasStyles';

type SupplierOption = {
  value: string;
  label: string;
};

type SupplierFilterModalProps = {
  visible: boolean;
  supplierFilter: string;
  supplierOptions: SupplierOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function SupplierFilterModal({
  visible,
  supplierFilter,
  supplierOptions,
  onSelect,
  onClose,
}: SupplierFilterModalProps) {
  const { t } = useTranslation();
  return (
    <StockyModal
      visible={visible}
      title={t('comprasSection.selectSupplier')}
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={30}
      bodyFlex
      onClose={onClose}
    >
      {supplierOptions.map((option) => {
        const selected = option.value === supplierFilter;
        return (
          <Pressable
            key={option.value}
            style={[s.modalOptionItem, selected && s.modalOptionItemSelected]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={[s.modalOptionItemText, selected && s.modalOptionItemTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
