import { Pressable, Text } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import { ventasStyles as s } from '../ventasStyles';

type SellerOption = {
  value: string;
  label: string;
};

type SellerFilterModalProps = {
  visible: boolean;
  sellerFilter: string;
  sellerOptions: SellerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function SellerFilterModal({
  visible,
  sellerFilter,
  sellerOptions,
  onSelect,
  onClose,
}: SellerFilterModalProps) {
  return (
    <StockyModal
      visible={visible}
      title="Seleccionar vendedor"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={30}
      bodyFlex
      onClose={onClose}
    >
      {sellerOptions.map((option) => {
        const selected = option.value === sellerFilter;
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
