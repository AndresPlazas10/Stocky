import { Text, View } from 'react-native';
import { StockyButton } from '../../../ui/StockyButton';
import { StockyModal } from '../../../ui/StockyModal';
import type { InventoryProductRecord } from '../../../services/inventoryService';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  visible: boolean;
  deleting: boolean;
  productTarget: InventoryProductRecord | null;
  deleteCheckResult: {
    has_sales: boolean;
    has_purchases: boolean;
    sales_count: number;
    purchases_count: number;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeactivateConfirmModal({
  visible,
  deleting,
  productTarget,
  deleteCheckResult,
  onClose,
  onConfirm,
}: Props) {
  return (
    <StockyModal
      visible={visible}
      title="Desactivar producto"
      onClose={onClose}
      footer={(
        <View style={styles.modalFooterRow}>
          <StockyButton
            variant="ghost"
            onPress={onClose}
            disabled={deleting}
          >
            Cancelar
          </StockyButton>
          <StockyButton onPress={onConfirm} loading={deleting} disabled={deleting}>
            Desactivar
          </StockyButton>
        </View>
      )}
    >
      <Text style={styles.modalText}>
        {deleteCheckResult?.has_sales && deleteCheckResult?.has_purchases
          ? `${productTarget?.name || 'Este producto'} tiene ${deleteCheckResult.sales_count} ventas y ${deleteCheckResult.purchases_count} compras registradas. No se puede eliminar.`
          : deleteCheckResult?.has_sales
            ? `${productTarget?.name || 'Este producto'} tiene ${deleteCheckResult.sales_count} ventas registradas. No se puede eliminar.`
            : `${productTarget?.name || 'Este producto'} tiene ${deleteCheckResult?.purchases_count || 0} compras registradas. No se puede eliminar.`
        }
      </Text>
      <Text style={styles.modalSubText}>Puedes desactivarlo para ocultarlo del catálogo activo.</Text>
    </StockyModal>
  );
}
