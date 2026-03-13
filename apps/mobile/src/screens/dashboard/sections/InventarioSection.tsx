import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { InventarioPanel } from '../../../features/inventario/InventarioPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function InventarioSection() {
  const { session, businessContext, businessError, loadingBusiness } = useDashboardContext();

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
    <InventarioPanel
      businessId={businessContext.businessId}
      businessName={businessContext.businessName}
      userId={session.user.id}
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
