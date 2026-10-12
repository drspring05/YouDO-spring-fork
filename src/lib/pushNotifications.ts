import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';
import { supabase } from './supabase';

let isInitialized = false;

export async function registerPushToken(userId: string, token: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );
    return !error;
  } catch (err) {
    console.warn('Could not register push token with backend:', err);
    return false;
  }
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase.from('user_push_tokens').delete().match({ user_id: userId, token });
  } catch {
    /* ignore */
  }
}

export function initPushNotifications(
  userId?: string,
  callbacks?: {
    onNavigate?: (route: 'today' | 'board' | 'social') => void;
  }
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  if (isInitialized) return () => {};
  isInitialized = true;

  const registrationSub = PushNotifications.addListener('registration', async (token: Token) => {
    if (userId) {
      await registerPushToken(userId, token.value);
    }
  });

  const registrationErrorSub = PushNotifications.addListener('registrationError', (err) => {
    console.warn('FCM registration error:', err);
  });

  const notificationReceivedSub = PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('FCM push notification received in foreground:', notification.title);
    }
  );

  const actionSub = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      const data = action.notification.data as Record<string, unknown> | undefined;
      const type = data?.type as string | undefined;

      if (type === 'morning_briefing') {
        callbacks?.onNavigate?.('today');
      } else if (type === 'community' || type === 'admin_hub' || type === 'hashtag_reply') {
        callbacks?.onNavigate?.('social');
      }
    }
  );

  void (async () => {
    try {
      const permStatus = await PushNotifications.checkPermissions();
      let granted = permStatus.receive === 'granted';
      if (!granted) {
        const reqStatus = await PushNotifications.requestPermissions();
        granted = reqStatus.receive === 'granted';
      }
      if (granted) {
        await PushNotifications.register();
      }
    } catch (err) {
      console.warn('Push notification initialization error:', err);
    }
  })();

  return () => {
    void registrationSub.then((h) => h.remove());
    void registrationErrorSub.then((h) => h.remove());
    void notificationReceivedSub.then((h) => h.remove());
    void actionSub.then((h) => h.remove());
    isInitialized = false;
  };
}
