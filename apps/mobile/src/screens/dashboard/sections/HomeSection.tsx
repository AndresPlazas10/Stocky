import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MesasPanel } from '../../../features/mesas/MesasPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function HomeSection() {
  const { session, businessContext, businessError, loadingBusiness } = useDashboardContext();

  return (
    <View style={styles.container}>
      {loadingBusiness ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={STOCKY_COLORS.primary900} />
        </View>
      ) : null}

      <MesasPanel
        session={session}
        businessContext={businessContext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  loadingContainer: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
