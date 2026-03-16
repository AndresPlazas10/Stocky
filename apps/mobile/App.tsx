import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EXPO_CONFIG } from './src/config/env';
import { useAuthSession } from './src/auth/useAuthSession';
import { useMobileNotifications } from './src/notifications/useMobileNotifications';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardApp } from './src/screens/dashboard/DashboardApp';
import { StockyBackground } from './src/ui/StockyBackground';
import { StockyCard } from './src/ui/StockyCard';
import { StockyErrorBoundary } from './src/ui/StockyErrorBoundary';
import { STOCKY_COLORS } from './src/theme/tokens';

export default function App() {
  const auth = useAuthSession();
  useMobileNotifications(auth.session);
  const hasSupabase = Boolean(EXPO_CONFIG.supabaseUrl && EXPO_CONFIG.supabaseAnonKey);

  if (!hasSupabase) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Configuración pendiente" subtitle="Faltan credenciales de Supabase">
                <Text style={styles.error}>
                  apps/mobile/.env requiere:
                  {'\n'}- EXPO_PUBLIC_SUPABASE_URL
                  {'\n'}- EXPO_PUBLIC_SUPABASE_ANON_KEY
                </Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  if (auth.loading) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Stocky Mobile" subtitle="Inicializando sesión">
                <ActivityIndicator size="small" color={STOCKY_COLORS.primary900} />
                <Text style={styles.subtitle}>Conectando con Supabase...</Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  if (auth.error) {
    return (
      <SafeAreaProvider>
        <StockyErrorBoundary>
          <StockyBackground>
            <SafeAreaView style={styles.container}>
              <StockyCard title="Error de autenticación">
                <Text style={styles.error}>{auth.error}</Text>
              </StockyCard>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            </SafeAreaView>
          </StockyBackground>
        </StockyErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StockyErrorBoundary>
        {auth.session ? <DashboardApp session={auth.session} /> : <AuthScreen />}
        <StatusBar style="dark" translucent backgroundColor="transparent" />
      </StockyErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    justifyContent: 'center',
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    color: STOCKY_COLORS.textSecondary,
    fontWeight: '600',
  },
  error: {
    color: STOCKY_COLORS.errorText,
    fontSize: 13,
    fontWeight: '600',
  },
  // Intentionally kept minimal styles here for boot screens.
});
