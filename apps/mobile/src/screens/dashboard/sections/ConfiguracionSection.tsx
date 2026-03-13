import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ConfiguracionPanel } from '../../../features/configuracion/ConfiguracionPanel';
import { STOCKY_COLORS } from '../../../theme/tokens';
import { useDashboardContext } from '../DashboardContext';

export function ConfiguracionSection() {
  const {
    session,
    businessContext,
    businessError,
    loadingBusiness,
    refreshBusinessContext,
    signOut,
  } = useDashboardContext();

  if (loadingBusiness) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <ConfiguracionPanel
      businessId={businessContext?.businessId || null}
      businessName={businessContext?.businessName || null}
      source={businessContext?.source || null}
      userId={session.user.id}
      userEmail={session.user.email || null}
      businessError={businessError}
      onRefreshBusiness={refreshBusinessContext}
      onSignOut={signOut}
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
