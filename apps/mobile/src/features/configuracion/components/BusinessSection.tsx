import { View } from 'react-native';
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
  return (
    <View style={styles.sectionCard}>
      <SectionHeader
        icon="business-outline"
        title="Información del Negocio"
        subtitle="Datos de tu empresa"
        actionLabel="Editar"
        onAction={onEdit}
      />
      <View style={styles.sectionBody}>
        <InfoItem icon="business-outline" label="Nombre del Negocio" value={businessNameLabel} />
        <InfoItem icon="shield-outline" label="NIT" value={businessNitLabel} />
        <InfoItem icon="mail-outline" label="Email" value={businessEmailLabel} />
        <InfoItem icon="call-outline" label="Teléfono" value={businessPhoneLabel} />
        <InfoItem icon="location-outline" label="Dirección" value={businessAddressLabel} />
      </View>
    </View>
  );
}
