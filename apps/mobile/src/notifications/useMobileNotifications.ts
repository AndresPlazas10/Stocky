import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import {
  configureMobileNotifications,
  deactivateOtherPushTokensForUser,
  deactivatePushTokenForUser,
  getMobileNotificationsModule,
  notifyAdminEmployeeLogin,
  registerPushTokenForSession,
  shouldEnableMobileNotificationsRuntime,
} from './mobileNotificationsService';
import { resolveBusinessContext } from '../services/mesasService';

export function useMobileNotifications(session: Session | null) {
  const previousUserIdRef = useRef<string | null>(null);
  const lastEmployeeLoginNotifyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldEnableMobileNotificationsRuntime()) return;
    configureMobileNotifications();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const previousUserId = String(previousUserIdRef.current || '').trim() || null;
    const currentUserId = String(session?.user?.id || '').trim() || null;

    if (previousUserId && (!currentUserId || currentUserId !== previousUserId)) {
      void deactivatePushTokenForUser(previousUserId);
    }

    previousUserIdRef.current = currentUserId;

    if (!session) return () => { cancelled = true; };
    if (Platform.OS === 'web') return () => { cancelled = true; };
    if (!shouldEnableMobileNotificationsRuntime()) return () => { cancelled = true; };

    void registerPushTokenForSession(session).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        console.log('[notifications] push token registration skipped', result.reason, result.message);
        return;
      }

      void (async () => {
        try {
          const businessContext = await resolveBusinessContext(session.user.id);
          if (!businessContext || businessContext.source !== 'owner') return;
          await deactivateOtherPushTokensForUser(session.user.id, result.installationId);
        } catch (error) {
          console.log('[notifications] cleanup old tokens error', error);
        }
      })();
    });

    const notifyKey = `${String(session.user.id || '').trim()}::${String(session.user.last_sign_in_at || '').trim()}`;
    if (notifyKey && lastEmployeeLoginNotifyKeyRef.current !== notifyKey) {
      void (async () => {
        try {
          const businessContext = await resolveBusinessContext(session.user.id);
          if (cancelled || !businessContext || businessContext.source !== 'employee') return;

          const employeeName = String(
            session.user.user_metadata?.full_name
            || session.user.user_metadata?.name
            || session.user.user_metadata?.username
            || session.user.email?.split('@')[0]
            || 'Empleado',
          );

          const result = await notifyAdminEmployeeLogin({
            accessToken: session.access_token,
            businessId: businessContext.businessId,
            employeeName,
          });

          if (cancelled) return;
          if (!result.ok) {
            console.log('[notifications] employee-login notify failed', result.message);
            return;
          }

          lastEmployeeLoginNotifyKeyRef.current = notifyKey;
        } catch (error) {
          if (cancelled) return;
          console.log('[notifications] employee-login notify error', error);
        }
      })();
    }

    let receivedSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    const Notifications = getMobileNotificationsModule();
    if (!Notifications) {
      return () => {
        cancelled = true;
      };
    }

    try {
      receivedSub = Notifications.addNotificationReceivedListener((notification) => {
        if (cancelled) return;
        console.log('[notifications] received', notification.request?.identifier || 'unknown');
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        if (cancelled) return;
        console.log('[notifications] tapped', response.notification.request?.identifier || 'unknown');
      });
    } catch (error) {
      console.log('[notifications] listeners skipped', error);
    }

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [session]);
}
