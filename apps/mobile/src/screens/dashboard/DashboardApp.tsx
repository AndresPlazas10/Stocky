import type { Session } from '@supabase/supabase-js';
import { DashboardProvider } from './DashboardContext';
import { AppNavigator } from '../../navigation/AppNavigator';

export function DashboardApp({ session }: { session: Session }) {
  return (
    <DashboardProvider session={session}>
      <AppNavigator />
    </DashboardProvider>
  );
}
