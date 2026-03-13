import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CombosPanel } from '../../../features/combos/CombosPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function CombosSection() {
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
    <CombosPanel
      businessId={businessContext.businessId}
      businessName={businessContext.businessName}
      source={businessContext.source}
      userId={session.user.id}
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
