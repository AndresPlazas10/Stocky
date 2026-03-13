import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { VentasPanel } from '../../../features/ventas/VentasPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function VentasSection() {
  const { businessContext, businessError, loadingBusiness } = useDashboardContext();

  if (loadingBusiness) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  if (businessError) {
    return null;
  }

  if (!businessContext?.businessId) {
    return null;
  }

  return (
    <VentasPanel
      businessId={businessContext.businessId}
      businessName={businessContext.businessName}
      source={businessContext.source}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
