import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ReportesPanel } from '../../../features/reportes/ReportesPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function ReportesSection() {
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
    <ReportesPanel
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
