import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { configuracionStyles as styles } from '../configuracionStyles';

interface BillingSectionProps {
  businessNameLabel: string;
  onOpenSiigo: () => void;
}

export function BillingSection({ businessNameLabel, onOpenSiigo }: BillingSectionProps) {
  return (
    <View style={styles.billingCard}>
      <View style={styles.billingHeader}>
        <View style={styles.billingHeaderIcon}>
          <Ionicons name="document-text-outline" size={28} color="#D1D5DB" />
        </View>
        <View style={styles.billingHeaderTextWrap}>
          <Text style={styles.billingHeaderTitle}>Facturación electrónica</Text>
          <Text style={styles.billingHeaderSubtitle}>Gestión externa al runtime de Stocky</Text>
        </View>
      </View>

      <View style={styles.billingBody}>
        <View style={styles.billingInfoBox}>
          <View style={styles.billingInfoTop}>
            <Ionicons name="information-circle-outline" size={24} color="#2563EB" />
            <Text style={styles.billingInfoTitle}>Estado actual del producto</Text>
          </View>
          <Text style={styles.billingInfoText}>
            Stocky no emite facturas electrónicas DIAN desde el runtime de la app. {businessNameLabel}
            {' '}debe gestionar su facturación oficial directamente en su proveedor autorizado.
          </Text>
        </View>

        <View style={styles.billingWarnBox}>
          <Text style={styles.billingWarnText}>
            Los comprobantes generados en Stocky son informativos y no reemplazan la factura electrónica oficial.
          </Text>
        </View>

        <Pressable style={styles.siigoButton} onPress={onOpenSiigo}>
          <Text style={styles.siigoButtonText}>Ir a Siigo</Text>
          <Ionicons name="open-outline" size={22} color="#E5E7EB" />
        </Pressable>
      </View>
    </View>
  );
}
