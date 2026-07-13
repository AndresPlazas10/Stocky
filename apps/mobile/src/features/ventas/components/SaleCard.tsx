import { memo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { formatDateTime } from '../../../utils/dateHelpers';
import { getBankLogoSource, isBankPaymentMethod } from '../../../utils/paymentMethodBranding';
import { getPaymentMethodLabel, getPaymentMethodTheme } from '../../../utils/paymentMethods';
import type { VentaRecord } from '../../../services/ventasService';
import { ventasStyles as s } from '../ventasStyles';

type SaleCardProps = {
  venta: VentaRecord;
  canDelete: boolean;
  onViewDetails: (venta: VentaRecord) => void;
  onPrint: (venta: VentaRecord) => void;
  onDelete: (venta: VentaRecord) => void;
};

export const SaleCard = memo(function SaleCard({
  venta,
  canDelete,
  onViewDetails,
  onPrint,
  onDelete,
}: SaleCardProps) {
  const { t } = useTranslation();
  return (
    <View style={s.saleCard}>
      <View style={s.saleDateRow}>
        <Ionicons name="calendar-outline" size={26} color="#111827" />
        <Text style={s.saleDateText}>{formatDateTime(venta.created_at)}</Text>
      </View>

      <View style={s.saleInfoGrid}>
        <View style={s.saleInfoColumn}>
          <View style={s.saleMetaBlock}>
            <Text style={s.saleMetaLabel}>{t('ventasSection.customer')}</Text>
            <Text style={s.saleMetaValue} numberOfLines={1}>
              {t('ventasSection.generalSale')}
            </Text>
          </View>
          <View style={s.saleMetaBlock}>
            <Text style={s.saleMetaLabel}>{t('ventasSection.vendor')}</Text>
            <Text style={s.saleMetaValue} numberOfLines={1}>
              {venta.seller_name || t('ventasSection.admin')}
            </Text>
          </View>
        </View>

        <View style={[s.saleInfoColumn, s.saleInfoColumnRight]}>
          <View style={s.paymentRow}>
            <Ionicons name="wallet-outline" size={20} color="#111827" />
            <View style={s.paymentPill}>
              {isBankPaymentMethod(venta.payment_method) ? (
                <Image
                  source={getBankLogoSource(venta.payment_method)!}
                  style={s.paymentIconLogo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name={getPaymentMethodTheme(venta.payment_method).icon}
                  size={13}
                  color="#166534"
                  style={s.paymentIcon}
                />
              )}
              <Text style={s.paymentPillText}>{getPaymentMethodLabel(venta.payment_method)}</Text>
            </View>
          </View>
          <View style={s.saleTotalBlock}>
            <Text style={s.saleCardTotalLabel}>{t('ventasSection.totalLabel')}</Text>
            <StockyMoneyText value={venta.total} style={s.saleCardTotalValue} />
          </View>
        </View>
      </View>

      <View style={s.saleActionRow}>
        <Pressable
          style={[s.saleDetailsButton, s.saleActionHalf]}
          onPress={() => onViewDetails(venta)}
        >
          <Ionicons name="eye-outline" size={20} color="#D1D5DB" />
          <Text style={s.saleDetailsText}>{t('buttons.viewDetails')}</Text>
        </Pressable>

        <Pressable style={[s.salePrintButton, s.saleActionHalf]} onPress={() => onPrint(venta)}>
          <Ionicons name="print-outline" size={20} color="#DCFCE7" />
          <Text style={s.salePrintText}>{t('buttons.print')}</Text>
        </Pressable>
      </View>

      {canDelete ? (
        <Pressable style={s.saleDeleteButton} onPress={() => onDelete(venta)}>
          <Ionicons name="trash-outline" size={20} color="#FEE2E2" />
          <Text style={s.saleDeleteText}>{t('buttons.delete')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
