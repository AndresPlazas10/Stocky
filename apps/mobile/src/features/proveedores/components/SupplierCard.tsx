import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <Text style={styles.supplierNitTagText}>NIT: {supplier.nit || t('proveedores.emptyValues.noNit')}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.supplierInfoGrid}>
        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="person-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>{t('proveedores.labels.contact')}</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.contact_name || t('proveedores.emptyValues.noContact')}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="mail-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>{t('proveedores.labels.email')}</Text>
          </View>
          <Text style={styles.infoLink} numberOfLines={2}>
            {supplier.email || t('proveedores.emptyValues.noEmail')}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="call-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>{t('proveedores.labels.phone')}</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.phone || t('proveedores.emptyValues.noPhone')}
          </Text>
        </View>

        <View style={styles.supplierInfoCell}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="location-outline" size={16} color="#111827" />
            <Text style={styles.infoLabel}>{t('proveedores.labels.address')}</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={2}>
            {supplier.address || t('proveedores.emptyValues.noAddress')}
          </Text>
        </View>

        {supplier.notes ? (
          <View style={[styles.supplierInfoCell, styles.supplierInfoCellFull]}>
            <Text style={styles.notesLabel}>{t('proveedores.labels.notes')}</Text>
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
              <Text style={styles.supplierEditButtonText}>{t('proveedores.edit')}</Text>
            </Pressable>
            <Pressable
              style={[styles.supplierDeleteButton, styles.supplierActionHalf]}
              onPress={() => onDelete(supplier)}
            >
              <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
              <Text style={styles.supplierDeleteButtonText}>{t('proveedores.delete')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
});
