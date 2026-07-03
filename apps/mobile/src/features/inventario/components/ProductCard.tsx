import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import type { InventoryProductRecord } from '../../../services/inventoryService';
import { getSupplierDisplayName } from '../inventoryUtils';
import { StatusBadge } from './StatusBadge';
import { inventarioStyles as styles } from '../inventarioStyles';

type Props = {
  product: InventoryProductRecord;
  canManageProducts: boolean;
  deleting: boolean;
  openEditModal: (p: InventoryProductRecord) => void;
  askDeleteProduct: (p: InventoryProductRecord) => void;
  activateProduct: (p: InventoryProductRecord) => void;
};

export const ProductCard = memo(function ProductCard({
  product,
  canManageProducts,
  deleting,
  openEditModal,
  askDeleteProduct,
  activateProduct,
}: Props) {
  const lowStock =
    product.manage_stock !== false && Number(product.stock || 0) <= Number(product.min_stock || 5);

  return (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productNameRow}>
          <Ionicons name="cube-outline" size={24} color="#111827" />
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
        </View>
      </View>

      <View style={styles.productTagRow}>
        <View style={styles.metaTag}>
          <Ionicons name="pricetag-outline" size={15} color="#111827" />
          <Text style={styles.metaTagText}>{product.code || 'Sin código'}</Text>
        </View>
        <View style={styles.categoryTag}>
          <Ionicons name="bar-chart-outline" size={15} color="#1D4ED8" />
          <Text style={styles.categoryTagText}>{product.category || 'General'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.productInfoGrid}>
        <View style={styles.infoCell}>
          <View style={styles.providerBlock}>
            <View style={styles.providerTitleRow}>
              <Ionicons name="business-outline" size={17} color="#111827" />
              <Text style={styles.providerLabel}>PROVEEDOR</Text>
            </View>
            <Text style={styles.providerValue}>{getSupplierDisplayName(product.supplier)}</Text>
          </View>
        </View>

        <View style={styles.infoCell}>
          <View style={styles.metricCell}>
            <View style={styles.metricTitleRow}>
              <Ionicons name="checkmark-done-outline" size={16} color="#111827" />
              <Text style={styles.metricLabel}>ESTADO</Text>
            </View>
            <StatusBadge active={product.is_active} />
          </View>
        </View>

        <View style={styles.infoCell}>
          <View style={styles.metricCell}>
            <View style={styles.metricTitleRow}>
              <Ionicons name="trending-down-outline" size={16} color="#C2410C" />
              <Text style={styles.metricLabel}>P. COMPRA</Text>
            </View>
            <StockyMoneyText value={product.purchase_price} style={styles.purchaseValue} />
          </View>
        </View>

        <View style={styles.infoCell}>
          <View style={styles.metricCell}>
            <View style={styles.metricTitleRow}>
              <Ionicons name="trending-up-outline" size={16} color="#059669" />
              <Text style={styles.metricLabel}>P. VENTA</Text>
            </View>
            <StockyMoneyText value={product.sale_price} style={styles.saleValue} />
          </View>
        </View>

        <View style={styles.infoCell}>
          <View style={styles.metricCell}>
            <View style={styles.metricTitleRow}>
              <Ionicons name="cube-outline" size={16} color="#111827" />
              <Text style={styles.metricLabel}>STOCK</Text>
            </View>
            <View style={styles.stockPill}>
              <Text style={[styles.stockText, lowStock && styles.lowStockText]}>
                {product.manage_stock !== false
                  ? `${product.stock} ${product.unit}`
                  : 'Sin control'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCell}>
          <View style={styles.metricCell}>
            <View style={styles.metricTitleRow}>
              <Ionicons name="warning-outline" size={16} color="#111827" />
              <Text style={styles.metricLabel}>MÍNIMO</Text>
            </View>
            <Text style={styles.minValue}>
              {product.manage_stock !== false
                ? `${product.min_stock} ${product.unit}`
                : 'No aplica'}
            </Text>
          </View>
        </View>
      </View>

      {canManageProducts ? (
        <>
          <View style={styles.divider} />
          <View style={styles.productActionsRow}>
            <Pressable
              style={[styles.editButton, styles.productActionHalf]}
              onPress={() => openEditModal(product)}
            >
              <Ionicons name="create-outline" size={18} color="#DDE6FF" />
              <Text style={styles.editButtonText}>Editar</Text>
            </Pressable>

            {product.is_active ? (
              <Pressable
                style={[styles.deleteButton, styles.productActionHalf]}
                onPress={() => askDeleteProduct(product)}
              >
                <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.activateButton, styles.productActionHalf]}
                onPress={() => activateProduct(product)}
                disabled={deleting}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#DCFCE7" />
                <Text style={styles.activateButtonText}>Activar</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
});
