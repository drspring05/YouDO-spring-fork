package com.mattedhairr.youdo;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps YouDO running while a focus sound plays with "Keep playing" on, so the
 * sound carries on with the screen off. It holds the live session card that is
 * already showing (no second notification) and leaves it in place when it stops.
 */
public class FocusSoundService extends Service {
    static void start(Context ctx) {
        Intent intent = new Intent(ctx, FocusSoundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent);
        else ctx.startService(intent);
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, FocusSoundService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            android.app.Notification card = SessionNotificationStore.buildCurrent(this);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(SessionNotificationStore.NOTIF_ID, card, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(SessionNotificationStore.NOTIF_ID, card);
            }
        } catch (Exception e) {
            stopSelf();
        }
        // If Android ends the app, the sound ends with it; nothing to restart.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        // Keep the session card while the session lasts; remove it once the session has ended.
        stopForeground(SessionNotificationStore.sessionJson(this) != null ? STOP_FOREGROUND_DETACH : STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
