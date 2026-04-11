import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DashboardProvider } from './DashboardContext';
import { AppNavigator } from '../../navigation/AppNavigator';
import { perfMark } from '../../utils/perfAudit';

export function DashboardApp({ session }: { session: Session }) {
  useEffect(() => {
    perfMark('dashboard_app_mounted', {
      userId: session.user.id,
    });
  }, [session.user.id]);

  return (
    <DashboardProvider session={session}>
      <AppNavigator />
    </DashboardProvider>
  );
}
