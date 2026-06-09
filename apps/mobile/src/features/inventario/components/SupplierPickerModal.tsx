import { Pressable, Text } from 'react-native';
import { StockyModal } from '../../../ui/StockyModal';
import type { InventorySupplierRecord } from '../../../services/inventoryService';
import { getSupplierDisplayName } from '../inventoryUtils';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  selectedSupplierId: string;
  suppliers: InventorySupplierRecord[];
  onSelect: (supplierId: string) => void;
  onClose: () => void;
};

export function SupplierPickerModal({ visible, selectedSupplierId, suppliers, onSelect, onClose }: Props) {
  return (
    <StockyModal
      visible={visible}
      title="Seleccionar proveedor"
      layout="centered"
      backdropVariant="blur"
      centeredOffsetY={26}
      modalAnimationType="fade"
      animationDurationMs={150}
      bodyFlex
      perfTag="inventario.picker_proveedor"
      onClose={onClose}
    >
      <Pressable
        style={[styles.modalOptionItem, !selectedSupplierId && styles.modalOptionItemSelected]}
        onPress={() => onSelect('')}
      >
        <Text style={[styles.modalOptionItemText, !selectedSupplierId && styles.modalOptionItemTextSelected]}>Sin proveedor</Text>
      </Pressable>
      {suppliers.map((supplier) => {
        const selected = selectedSupplierId === supplier.id;
        return (
          <Pressable
            key={supplier.id}
            style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
            onPress={() => onSelect(supplier.id)}
          >
            <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>
              {getSupplierDisplayName(supplier)}
            </Text>
          </Pressable>
        );
      })}
    </StockyModal>
  );
}
