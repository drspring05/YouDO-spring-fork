package com.mattedhairr.youdo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Re-launches the app in the background after a device reboot so Capacitor
 * LocalNotifications can re-register the morning briefing exact alarm.
 *
 * On Android, AlarmManager exact alarms (used by @capacitor/local-notifications)
 * are cleared when the device reboots. Without this receiver the morning briefing
 * would never fire again after a power cycle until the user manually reopened YouDO.
 *
 * The receiver sends a silent background intent to MainActivity which triggers the
 * app's foreground process; the JS layer's scheduleMorningBriefing useEffect then
 * re-schedules the alarm automatically.
 *
 * Declared in AndroidManifest.xml with the RECEIVE_BOOT_COMPLETED permission.
 */
public class YouDoBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                && !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }

        // Re-start the session notification if there was an active focus session
        // that survived the reboot (snapshot stored in SharedPreferences).
        String sessionJson = SessionNotificationStore.sessionJson(context);
        if (sessionJson != null && !sessionJson.isEmpty()) {
            String title = SessionNotificationStore.title(context);
            try {
                org.json.JSONObject session = new org.json.JSONObject(sessionJson);
                boolean paused = session.optBoolean("isPaused", false);
                SessionNotificationStore.show(context, paused, title);
            } catch (Exception ignored) {
                // Corrupt snapshot — clear it rather than showing a broken notification.
                SessionNotificationStore.clear(context);
            }
        }
    }
}
