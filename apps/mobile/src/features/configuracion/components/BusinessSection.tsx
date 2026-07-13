import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { InfoItem } from './InfoItem';
import { SectionHeader } from './SectionHeader';
import { configuracionStyles as styles } from '../configuracionStyles';

interface BusinessSectionProps {
  businessNameLabel: string;
  businessNitLabel: string;
  businessEmailLabel: string;
  businessPhoneLabel: string;
  businessAddressLabel: string;
  onEdit: () => void;
}

export function BusinessSection({
  businessNameLabel,
  businessNitLabel,
  businessEmailLabel,
  businessPhoneLabel,
  businessAddressLabel,
  onEdit,
}: BusinessSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionCard}>
      <SectionHeader
        icon="business-outline"
        title={t('configuracion.business.title')}
        subtitle={t('configuracion.business.subtitle')}
        actionLabel={t('configuracion.business.edit')}
        onAction={onEdit}
      />
      <View style={styles.sectionBody}>
        <InfoItem
          icon="business-outline"
          label={t('configuracion.business.name')}
          value={businessNameLabel}
        />
        <InfoItem
          icon="shield-outline"
          label={t('configuracion.business.nit')}
          value={businessNitLabel}
        />
        <InfoItem
          icon="mail-outline"
          label={t('configuracion.business.email')}
          value={businessEmailLabel}
        />
        <InfoItem
          icon="call-outline"
          label={t('configuracion.business.phone')}
          value={businessPhoneLabel}
        />
        <InfoItem
          icon="location-outline"
          label={t('configuracion.business.address')}
          value={businessAddressLabel}
        />
      </View>
    </View>
  );
}
