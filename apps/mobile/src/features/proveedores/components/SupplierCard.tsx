import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProveedorRecord } from '../../../services/proveedoresService';
import { proveedoresStyles as styles } from '../proveedoresStyles';

interface SupplierCardProps {
  supplier: ProveedorRecord;
  canManageSuppliers: boolean;
  onEdit: (supplier: ProveedorRecord) => void;
  onDelete: (supplier: ProveedorRecord) => void;
}

export const SupplierCard = memo(function SupplierCard({
  supplier,
  canManageSuppliers,
  onEdit,
  onDelete,
}: SupplierCardProps) {
  return (
    <View style={styles.supplierCard}>
      <View style={styles.supplierHeader}>
        <View style={styles.supplierHeaderMain}>
          <Ionicons name="business-outline" size={24} color="#111827" />
          <Text style={styles.supplierTitle} numberOfLines={1}>
            {supplier.business_name}
          </Text>
        </View>
      </View>

      <View style={styles.supplierTagRow}>
        <View style={styles.supplierNitTag}>
          <Ionicons name="document-text-outline" size={13} color="#111827" />
          <Text style={styles.supplierNitTagText}>NIT: {supplier.nit || 'Sin NIT'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.supplierInfoGrid}>
        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="person-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>CONTACTO</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.contact_name || 'Sin contacto'}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="mail-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>EMAIL</Text>
          </View>
          <Text style={styles.infoLink} numberOfLines={2}>
            {supplier.email || 'Sin email'}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="call-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>TELÉFONO</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.phone || 'Sin teléfono'}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="location-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>DIRECCIÓN</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.address || 'Sin dirección'}
          </Text>
        </View>

        {supplier.notes ? (
          <View style={[styles.supplierInfoCell, styles.supplierInfoCellFull]}>
            <Text style={styles.notesLabel}>NOTAS</Text>
            <Text style={styles.notesText}>{supplier.notes}</Text>
          </View>
        ) : null}
      </View>

      {canManageSuppliers ? (
        <>
          <View style={styles.divider} />
          <View style={styles.supplierActionsRow}>
            <Pressable
              style={[styles.supplierEditButton, styles.supplierActionHalf]}
              onPress={() => onEdit(supplier)}
            >
              <Ionicons name="create-outline" size={18} color="#DDE6FF" />
              <Text style={styles.supplierEditButtonText}>Editar</Text>
            </Pressable>
            <Pressable
              style={[styles.supplierDeleteButton, styles.supplierActionHalf]}
              onPress={() => onDelete(supplier)}
            >
              <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
              <Text style={styles.supplierDeleteButtonText}>Eliminar</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
});
