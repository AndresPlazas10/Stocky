import { memo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { formatDateTime } from '../../../utils/dateHelpers';
import { getBankLogoSource, isBankPaymentMethod } from '../../../utils/paymentMethodBranding';
import { getPaymentMethodLabel, getPaymentMethodTheme } from '../../../utils/paymentMethods';
import type { CompraRecord } from '../../../services/comprasService';
import { comprasStyles as s } from '../comprasStyles';

type PurchaseCardProps = {
  purchase: CompraRecord;
  canDelete: boolean;
  supplierLabel: string;
  onViewDetails: (purchase: CompraRecord) => void;
  onDelete: (purchase: CompraRecord) => void;
};

export const PurchaseCard = memo(function PurchaseCard({
  purchase,
  canDelete,
  supplierLabel,
  onViewDetails,
  onDelete,
}: PurchaseCardProps) {
  const { t } = useTranslation();
  return (
    <View style={s.saleCard}>
      <View style={s.saleDateRow}>
        <Ionicons name="calendar-outline" size={26} color="#111827" />
        <Text style={s.saleDateText}>{formatDateTime(purchase.created_at)}</Text>
      </View>

      <View style={s.saleInfoGrid}>
        <View style={s.saleInfoColumn}>
          <View style={s.saleMetaBlock}>
            <Text style={s.saleMetaLabel}>{t('comprasSection.supplierLabel')}</Text>
            <Text style={s.saleMetaValue}>{supplierLabel}</Text>
          </View>
        </View>

        <View style={[s.saleInfoColumn, s.saleInfoColumnRight]}>
          <View style={s.paymentRow}>
            <Ionicons name="wallet-outline" size={20} color="#111827" />
            <View style={s.paymentPill}>
              {isBankPaymentMethod(purchase.payment_method) ? (
                <Image
                  source={getBankLogoSource(purchase.payment_method)!}
                  style={s.paymentIconLogo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name={getPaymentMethodTheme(purchase.payment_method).icon}
                  size={13}
                  color="#166534"
                  style={s.paymentIcon}
                />
              )}
              <Text style={s.paymentPillText}>
                {getPaymentMethodLabel(purchase.payment_method)}
              </Text>
            </View>
          </View>
          <View style={s.saleTotalBlock}>
            <Text style={s.saleCardTotalLabel}>{t('ventasSection.totalLabel')}</Text>
            <StockyMoneyText value={purchase.total} style={s.saleCardTotalValue} />
          </View>
        </View>
      </View>

      <View style={s.saleActionRow}>
        <Pressable
          style={[s.saleDetailsButton, s.saleActionHalf]}
          onPress={() => onViewDetails(purchase)}
        >
          <Ionicons name="eye-outline" size={20} color="#D1D5DB" />
          <Text style={s.saleDetailsText}>{t('buttons.viewDetails')}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[s.saleDeleteButton, !canDelete && s.buttonDisabled]}
        onPress={() => onDelete(purchase)}
        disabled={!canDelete}
      >
        <Ionicons name="trash-outline" size={20} color="#FEE2E2" />
        <Text style={s.saleDeleteText}>{t('buttons.delete')}</Text>
      </Pressable>
    </View>
  );
});
